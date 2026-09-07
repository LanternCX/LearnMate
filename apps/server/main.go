package main

import (
	"log"
	"net/http"
	"time"
)

func handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte("ok\n"))
	})
	return mux
}

func main() {
	server := &http.Server{
		Addr:              "127.0.0.1:8080",
		Handler:           handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("Zhiya server listening on http://%s", server.Addr)
	log.Fatal(server.ListenAndServe())
}
