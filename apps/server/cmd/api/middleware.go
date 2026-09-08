package main

import (
	"context"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/LanternCX/zhiya/apps/server/internal/data"
)

func (a *application) protect(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
			defer cancel()
			r = r.WithContext(ctx)
			if r.Method != "GET" {
				origin := r.Header.Get("Origin")
				scheme := "http"
				if a.secure {
					scheme = "https"
				}
				allowed := a.origin
				if allowed == "" {
					allowed = scheme + "://" + r.Host
				}
				if r.Header.Get("X-Zhiya-Request") != "1" || (origin != "" && origin != allowed) || r.Header.Get("Sec-Fetch-Site") == "cross-site" {
					respondError(w, failure{403, "请求来源无效。"})
					return
				}
				if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
					respondError(w, failure{415, "请使用 JSON 提交。"})
					return
				}
			}
			if strings.HasPrefix(r.URL.Path, "/api/auth/") || r.Method != "GET" {
				ip, _, _ := net.SplitHostPort(r.RemoteAddr)
				if err := a.models.Tokens.Limit(r.Context(), "ip:"+ip, 60); err != nil {
					respondError(w, err)
					return
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}
func sessionToken(r *http.Request) string {
	c, err := r.Cookie("zhiya_session")
	if err != nil {
		return ""
	}
	return c.Value
}

// Authentication and mutation share a transaction so revocation cannot race a write.
func (a *application) withUser(r *http.Request, mode data.TransactionMode, action func(data.Models, data.User) error) error {
	return a.models.Transaction(r.Context(), mode, func(models data.Models) error {
		token := sessionToken(r)
		if token == "" {
			return data.ErrInvalidSession
		}
		u, err := models.Users.GetBySession(r.Context(), token, r.Header.Get("X-Zhiya-User"))
		if err != nil {
			return err
		}
		return action(models, u)
	})
}
func (a *application) emailInput(r *http.Request, email, prefix string, max int) (string, error) {
	email, err := data.NormalizeEmail(email)
	if err != nil {
		return "", err
	}
	return email, a.models.Tokens.Limit(r.Context(), prefix+email, max)
}
