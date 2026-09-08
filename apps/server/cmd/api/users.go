package main

import (
	"net/http"

	"github.com/LanternCX/zhiya/apps/server/internal/data"
)

func (a *application) completeRegistration(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Flow     string `json:"flow"`
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	if err := readJSON(w, r, &in); err != nil {
		respondError(w, err)
		return
	}
	if err := passwordLength(in.Password); err != nil {
		respondError(w, err)
		return
	}
	err := a.models.Transaction(r.Context(), data.IdentityTransaction, func(models data.Models) error {
		if err := data.ValidatePassword(in.Password); err != nil {
			return err
		}
		c, err := models.Tokens.VerifyChallenge(r.Context(), in.Flow, in.Code, "", "register", "")
		if err != nil {
			return err
		}
		if err = models.Users.Insert(r.Context(), c.Email, in.Password); err != nil {
			return err
		}
		return models.Tokens.DeleteRegistrationChallenges(r.Context(), c.Email)
	})
	respondOK(w, err)
}
func (a *application) completePasswordReset(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Flow     string `json:"flow"`
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	if err := readJSON(w, r, &in); err != nil {
		respondError(w, err)
		return
	}
	if err := passwordLength(in.Password); err != nil {
		respondError(w, err)
		return
	}
	err := a.models.Transaction(r.Context(), data.IdentityTransaction, func(models data.Models) error {
		if err := data.ValidatePassword(in.Password); err != nil {
			return err
		}
		id, err := models.Users.GetByChallenge(r.Context(), in.Flow)
		if err != nil {
			return err
		}
		c, err := models.Tokens.VerifyChallenge(r.Context(), in.Flow, in.Code, "", "reset", id)
		if err != nil {
			return err
		}
		if err = models.Users.UpdatePassword(r.Context(), id, in.Password); err != nil {
			return err
		}
		return models.Tokens.Revoke(r.Context(), id, c.Email)
	})
	a.sessionResult(w, "", err)
}
func (a *application) getProfile(w http.ResponseWriter, r *http.Request) {
	var current data.User
	err := a.withUser(r, data.StandardTransaction, func(models data.Models, u data.User) error { current = u; return nil })
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, current)
}
func (a *application) updateNickname(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Nickname string `json:"nickname"`
	}
	if err := readJSON(w, r, &in); err != nil {
		respondError(w, err)
		return
	}
	err := a.withUser(r, data.StandardTransaction, func(models data.Models, u data.User) error {
		return models.Users.UpdateNickname(r.Context(), u.ID, in.Nickname)
	})
	respondOK(w, err)
}
func (a *application) updateAvatar(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Avatar string `json:"avatar"`
	}
	if err := readJSON(w, r, &in); err != nil {
		respondError(w, err)
		return
	}
	err := a.withUser(r, data.StandardTransaction, func(models data.Models, u data.User) error {
		return models.Users.UpdateAvatar(r.Context(), u.ID, in.Avatar)
	})
	respondOK(w, err)
}
func (a *application) changePassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Password        string `json:"password"`
		CurrentPassword string `json:"currentPassword"`
	}
	if err := readJSON(w, r, &in); err != nil {
		respondError(w, err)
		return
	}
	if err := passwordLength(in.Password, in.CurrentPassword); err != nil {
		respondError(w, err)
		return
	}
	err := a.withUser(r, data.IdentityTransaction, func(models data.Models, u data.User) error {
		if err := data.ValidatePassword(in.Password); err != nil {
			return err
		}
		if !u.PasswordMatches(in.CurrentPassword) {
			return bad("当前密码不正确。")
		}
		if err := models.Users.UpdatePassword(r.Context(), u.ID, in.Password); err != nil {
			return err
		}
		return models.Tokens.Revoke(r.Context(), u.ID, u.Email)
	})
	a.sessionResult(w, "", err)
}
func (a *application) startEmailChange(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
	}
	if err := readJSON(w, r, &in); err != nil {
		respondError(w, err)
		return
	}
	email, err := a.emailInput(r, in.Email, "mail:", 5)
	if err != nil {
		respondError(w, err)
		return
	}
	if token := sessionToken(r); token != "" {
		if err = a.models.Tokens.Limit(r.Context(), "email-change:"+token, 5); err != nil {
			respondError(w, err)
			return
		}
	}
	var flow string
	err = a.withUser(r, data.StandardTransaction, func(models data.Models, u data.User) error {
		if email == u.Email {
			return bad("请输入不同的新邮箱。")
		}
		exists, err := models.Users.EmailExists(r.Context(), email)
		if err != nil {
			return err
		}
		if exists {
			return bad("该邮箱无法使用，请换一个邮箱。")
		}
		flow, err = a.sendChallenge(r.Context(), models, "email", u.Email, email, u.ID)
		return err
	})
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"flow": flow})
}
func (a *application) completeEmailChange(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Flow    string `json:"flow"`
		Code    string `json:"code"`
		NewCode string `json:"newCode"`
	}
	if err := readJSON(w, r, &in); err != nil {
		respondError(w, err)
		return
	}
	err := a.withUser(r, data.IdentityTransaction, func(models data.Models, u data.User) error {
		c, err := models.Tokens.VerifyChallenge(r.Context(), in.Flow, in.Code, in.NewCode, "email", u.ID)
		if err != nil {
			return err
		}
		if c.Email != u.Email {
			return data.ErrInvalidCode
		}
		if err = models.Users.UpdateEmail(r.Context(), u.ID, c.NewEmail); err != nil {
			return err
		}
		return models.Tokens.DeleteEmailChallenges(r.Context(), u.ID, u.Email, c.NewEmail)
	})
	respondOK(w, err)
}
func (a *application) deleteAccount(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Confirm         bool   `json:"confirm"`
		CurrentPassword string `json:"currentPassword"`
	}
	if err := readJSON(w, r, &in); err != nil {
		respondError(w, err)
		return
	}
	if err := passwordLength(in.CurrentPassword); err != nil {
		respondError(w, err)
		return
	}
	err := a.withUser(r, data.IdentityTransaction, func(models data.Models, u data.User) error {
		if !in.Confirm {
			return bad("请确认永久删除账号及关联个人数据。")
		}
		if !u.PasswordMatches(in.CurrentPassword) {
			return bad("当前密码不正确。")
		}
		if err := models.Tokens.Revoke(r.Context(), u.ID, u.Email); err != nil {
			return err
		}
		return models.Users.Delete(r.Context(), u.ID)
	})
	a.sessionResult(w, "", err)
}
