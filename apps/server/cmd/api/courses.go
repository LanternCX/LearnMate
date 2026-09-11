package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/LanternCX/zhiya/apps/server/internal/data"
)

const (
	courseTitleMax = 80
	courseTopicMax = 240
	courseLabelMax = 32
)

var courseMotifs = map[string]bool{
	"code": true, "orbit": true, "geometry": true, "language": true,
	"nature": true, "history": true, "abstract": true,
}

var coursePalettes = map[string]bool{
	"sprout": true, "sunrise": true, "ocean": true, "berry": true, "clay": true,
}

func courseText(value, field string, max int) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len([]rune(value)) > max {
		return "", bad(field + "无效")
	}
	return value, nil
}

func (a *application) listCourses(w http.ResponseWriter, r *http.Request) {
	var courses []data.Course
	err := a.withUser(r, data.StandardTransaction, func(m data.Models, u data.User) error {
		var err error
		courses, err = m.Courses.List(r.Context(), u.ID)
		return err
	})
	if err != nil {
		a.respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"courses": courses})
}

func (a *application) createCourse(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Title string `json:"title"`
		Topic string `json:"topic"`
		Cover struct {
			Motif   string `json:"motif"`
			Palette string `json:"palette"`
			Label   string `json:"label"`
		} `json:"cover"`
	}
	if err := a.readJSON(w, r, &input); err != nil {
		a.respondError(w, err)
		return
	}
	title, err := courseText(input.Title, "课程名称", courseTitleMax)
	if err != nil {
		a.respondError(w, err)
		return
	}
	topic, err := courseText(input.Topic, "课程主题", courseTopicMax)
	if err != nil {
		a.respondError(w, err)
		return
	}
	label, err := courseText(input.Cover.Label, "封面标识", courseLabelMax)
	if err != nil || !courseMotifs[input.Cover.Motif] || !coursePalettes[input.Cover.Palette] {
		a.respondError(w, bad("课程封面无效"))
		return
	}
	cover := data.CourseCover{Motif: input.Cover.Motif, Palette: input.Cover.Palette, Label: label}
	var course data.Course
	err = a.withUser(r, data.StandardTransaction, func(m data.Models, u data.User) error {
		course, err = m.Courses.Create(r.Context(), u.ID, title, topic, cover)
		return err
	})
	if err != nil {
		a.respondError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"course": course})
}

func (a *application) getCourse(w http.ResponseWriter, r *http.Request) {
	var course data.Course
	err := a.withUser(r, data.StandardTransaction, func(m data.Models, u data.User) error {
		var err error
		course, err = m.Courses.Get(r.Context(), u.ID, r.PathValue("id"))
		return err
	})
	if err != nil {
		a.respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": course})
}

func (a *application) updateCourse(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Title *string `json:"title"`
		Topic *string `json:"topic"`
	}
	if err := a.readJSON(w, r, &input); err != nil {
		a.respondError(w, err)
		return
	}
	var course data.Course
	err := a.withUser(r, data.StandardTransaction, func(m data.Models, u data.User) error {
		current, err := m.Courses.Get(r.Context(), u.ID, r.PathValue("id"))
		if err != nil {
			return err
		}
		title, topic := current.Title, current.Topic
		if input.Title != nil {
			title, err = courseText(*input.Title, "课程名称", courseTitleMax)
			if err != nil {
				return err
			}
		}
		if input.Topic != nil {
			topic, err = courseText(*input.Topic, "课程主题", courseTopicMax)
			if err != nil {
				return err
			}
		}
		course, err = m.Courses.Update(r.Context(), u.ID, current.ID, title, topic)
		return err
	})
	if err != nil {
		a.respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": course})
}

func (a *application) saveCourseConversation(w http.ResponseWriter, r *http.Request) {
	var input struct {
		ConversationID string          `json:"conversationId"`
		State          json.RawMessage `json:"state"`
	}
	if err := a.readJSON(w, r, &input); err != nil || input.ConversationID == "" || len(input.State) == 0 || !json.Valid(input.State) {
		if err == nil {
			err = bad("课程对话无效")
		}
		a.respondError(w, err)
		return
	}
	err := a.withUser(r, data.StandardTransaction, func(m data.Models, u data.User) error {
		return m.Courses.SaveConversation(r.Context(), u.ID, r.PathValue("id"), input.ConversationID, input.State)
	})
	a.respondOK(w, err)
}

func (a *application) deleteCourse(w http.ResponseWriter, r *http.Request) {
	err := a.withUser(r, data.StandardTransaction, func(m data.Models, u data.User) error {
		return m.Courses.Delete(r.Context(), u.ID, r.PathValue("id"))
	})
	a.respondOK(w, err)
}
