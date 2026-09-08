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

	"github.com/LanternCX/zhiya/apps/server/internal/data"
	"github.com/LanternCX/zhiya/apps/server/internal/mailer"
	"github.com/jackc/pgx/v5/pgxpool"
)

type application struct {
	models data.Models
	send   func(to, purpose, code string) error
	secure bool
	origin string
	web    string
}

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
	send, err := mailer.New(address, from, os.Getenv("SMTP_USER"), os.Getenv("SMTP_PASSWORD"), *dev)
	if err != nil {
		log.Fatal(err)
	}
	startup, cancel := context.WithTimeout(ctx, 15*time.Second)
	app := &application{models: data.NewModels(db), send: send, secure: !*dev, origin: origin, web: *web}
	err = app.models.Initialize(startup)
	cancel()
	if err != nil {
		log.Fatal("database initialization failed: ", err)
	}
	server := &http.Server{
		Addr:              env("LISTEN_ADDR", "127.0.0.1:8080"),
		Handler:           app.routes(),
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
				err := app.models.Tokens.CleanupExpired(ctx)
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
