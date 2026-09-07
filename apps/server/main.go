package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func main() {
	dev := flag.Bool("dev", false, "use loopback PostgreSQL and Mailpit for local development")
	web := flag.String("web", "../client/dist", "built web client directory")
	flag.Parse()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	databaseURL := os.Getenv("DATABASE_URL")
	if *dev {
		databaseURL = env("DATABASE_URL", "postgres://zhiya:zhiya-local@127.0.0.1:54329/zhiya?sslmode=disable")
	}
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required (or use -dev for local development)")
	}
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatal("invalid database configuration")
	}
	defer db.Close()
	startup, cancel := context.WithTimeout(ctx, 15*time.Second)
	err = migrate(startup, db)
	cancel()
	if err != nil {
		log.Fatal("database initialization failed: ", err)
	}
	origin := env("APP_ORIGIN", "http://127.0.0.1:1420")
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Host == "" || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.User != nil || (!*dev && parsed.Scheme != "https") {
		log.Fatal("APP_ORIGIN must be an HTTPS origin outside development")
	}
	address, from := os.Getenv("SMTP_ADDR"), os.Getenv("SMTP_FROM")
	if *dev {
		address = env("SMTP_ADDR", "127.0.0.1:1025")
		from = env("SMTP_FROM", "Zhiya <noreply@zhiya.local>")
	}
	send, err := smtpSender(address, from, os.Getenv("SMTP_USER"), os.Getenv("SMTP_PASSWORD"), *dev)
	if err != nil {
		log.Fatal(err)
	}
	app := &accounts{db: db, send: send, secure: !*dev, origin: origin}
	mux := http.NewServeMux()
	mux.Handle("/api/", app.handler())
	mux.Handle("/health", app.handler())
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'")
		w.Header().Set("Referrer-Policy", "no-referrer")
		http.FileServer(http.Dir(*web)).ServeHTTP(w, r)
	}))
	server := &http.Server{
		Addr:              env("LISTEN_ADDR", "127.0.0.1:8080"),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				_ = server.Shutdown(shutdown)
				return
			case <-ticker.C:
				_, err := db.Exec(ctx, "DELETE FROM challenges WHERE expires_at<now(); DELETE FROM sessions WHERE expires_at<now(); DELETE FROM auth_limits WHERE expires_at<now()")
				if err != nil {
					log.Print("expired account data cleanup failed")
				}
			}
		}
	}()
	log.Printf("Zhiya server listening on %s", server.Addr)
	if err = server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
