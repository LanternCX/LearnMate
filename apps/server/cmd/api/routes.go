package main

import (
	"io"
	"net/http"

	"github.com/LanternCX/zhiya/apps/server/internal/data"
)

func (a *application) routes() http.Handler {
	api := http.NewServeMux()
	api.HandleFunc("GET /api/learning", a.learning)
	api.HandleFunc("POST /api/learning/action", a.learningAction)
	api.HandleFunc("POST /api/learning/sync", a.learningSync)
	api.HandleFunc("GET /api/learning/model", a.modelInfo)
	api.HandleFunc("POST /api/learning/model", a.modelProxy)
	api.HandleFunc("GET /api/account-rules", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, data.AccountRules())
	})
	api.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = io.WriteString(w, "ok\n")
	})
	api.HandleFunc("POST /api/auth/register/start", a.startRegistration)
	api.HandleFunc("POST /api/auth/register/complete", a.completeRegistration)
	api.HandleFunc("POST /api/auth/login", a.login)
	api.HandleFunc("GET /api/me", a.getProfile)
	api.HandleFunc("POST /api/auth/reset/start", a.startPasswordReset)
	api.HandleFunc("POST /api/auth/reset/complete", a.completePasswordReset)
	api.HandleFunc("POST /api/auth/logout", a.logout)
	api.HandleFunc("POST /api/auth/logout-all", a.logoutAll)
	api.HandleFunc("PUT /api/me/password", a.changePassword)
	api.HandleFunc("PATCH /api/me", a.updateNickname)
	api.HandleFunc("PUT /api/me/avatar", a.updateAvatar)
	api.HandleFunc("POST /api/me/email/start", a.startEmailChange)
	api.HandleFunc("POST /api/me/email/complete", a.completeEmailChange)
	api.HandleFunc("DELETE /api/me", a.deleteAccount)
	mux := http.NewServeMux()
	protected := a.protect(api)
	mux.Handle("/api/", protected)
	mux.Handle("/health", protected)
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'")
		w.Header().Set("Referrer-Policy", "no-referrer")
		http.FileServer(http.Dir(a.config.Server.WebDir)).ServeHTTP(w, r)
	}))
	return mux
}
