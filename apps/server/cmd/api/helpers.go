package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	"github.com/LanternCX/zhiya/apps/server/internal/data"
)

type failure struct {
	status  int
	message string
}

func (e failure) Error() string { return e.message }
func bad(message string) error  { return failure{400, message} }
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func respondError(w http.ResponseWriter, err error) {
	var e failure
	var validation data.ValidationError
	switch {
	case errors.As(err, &e):
	case errors.As(err, &validation):
		e = failure{400, validation.Error()}
	case errors.Is(err, data.ErrInvalidCode):
		e = failure{400, err.Error()}
	case errors.Is(err, data.ErrInvalidSession):
		e = failure{401, err.Error()}
	case errors.Is(err, data.ErrEmailInUse):
		e = failure{409, err.Error()}
	case errors.Is(err, data.ErrRateLimited):
		e = failure{429, err.Error()}
	default:
		log.Printf("account operation failed: %T", err)
		e = failure{500, "服务暂时不可用，请稍后重试。"}
	}
	if e.status == 429 {
		w.Header().Set("Retry-After", "60")
	}
	writeJSON(w, e.status, map[string]string{"error": e.message})
}
func readJSON(w http.ResponseWriter, r *http.Request, value any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 3*1024*1024)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return bad("提交内容无效或过大。")
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return bad("提交内容无效。")
	}
	return nil
}
func passwordLength(passwords ...string) error {
	for _, password := range passwords {
		if len(password) > 256 {
			return bad("密码过长。")
		}
	}
	return nil
}
func respondOK(w http.ResponseWriter, err error) {
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
func (a *application) cookie(w http.ResponseWriter, token string) {
	c := &http.Cookie{Name: "zhiya_session", Value: token, Path: "/", HttpOnly: true, Secure: a.secure, SameSite: http.SameSiteStrictMode, MaxAge: 30 * 24 * 60 * 60}
	if token == "" {
		c.MaxAge = -1
	}
	http.SetCookie(w, c)
}
func (a *application) sessionResult(w http.ResponseWriter, token string, err error) {
	if err == nil {
		a.cookie(w, token)
	}
	respondOK(w, err)
}
