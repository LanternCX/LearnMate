package main

import (
	"net/http"
	"testing"
)

func TestCourseCRUDPersistsOneConversation(t *testing.T) {
	a := setupAccountTest(t)
	student := a.register("courses@example.com")

	created := a.request(student, "POST", "/courses", map[string]any{
		"title": "认识人工智能",
		"topic": "从生活中的例子理解人工智能",
		"cover": map[string]any{
			"motif":   "code",
			"palette": "sprout",
			"label":   "COMPUTING · 01",
		},
	}, http.StatusCreated)["course"].(map[string]any)
	id := created["id"].(string)
	conversationID := created["conversationId"].(string)
	if id == "" || conversationID == "" {
		t.Fatalf("course did not create its first conversation: %v", created)
	}
	cover := created["cover"].(map[string]any)
	if cover["motif"] != "code" || cover["palette"] != "sprout" || cover["label"] != "COMPUTING · 01" {
		t.Fatalf("course cover was not preserved: %v", cover)
	}

	state := map[string]any{
		"messages":          []any{map[string]any{"id": 1, "role": "user", "text": "什么是人工智能？"}},
		"slides":            []any{},
		"presentedSlideIds": []any{},
		"currentSlideId":    "",
	}
	a.request(student, "PUT", "/courses/"+id+"/conversation", map[string]any{
		"conversationId": conversationID,
		"state":          state,
	}, http.StatusOK)

	listed := a.request(student, "GET", "/courses", nil, http.StatusOK)["courses"].([]any)
	if len(listed) != 1 || listed[0].(map[string]any)["title"] != "认识人工智能" {
		t.Fatalf("created course not listed: %v", listed)
	}
	restored := a.request(student, "GET", "/courses/"+id, nil, http.StatusOK)["course"].(map[string]any)
	messages := restored["state"].(map[string]any)["messages"].([]any)
	if len(messages) != 1 || messages[0].(map[string]any)["text"] != "什么是人工智能？" {
		t.Fatalf("conversation was not restored: %v", restored)
	}

	updated := a.request(student, "PATCH", "/courses/"+id, map[string]any{
		"title": "人工智能入门",
	}, http.StatusOK)["course"].(map[string]any)
	if updated["title"] != "人工智能入门" {
		t.Fatalf("course was not renamed: %v", updated)
	}

	a.request(student, "DELETE", "/courses/"+id, nil, http.StatusOK)
	listed = a.request(student, "GET", "/courses", nil, http.StatusOK)["courses"].([]any)
	if len(listed) != 0 {
		t.Fatalf("deleted course still listed: %v", listed)
	}
}

func TestCoursesArePrivateToTheirStudent(t *testing.T) {
	a := setupAccountTest(t)
	owner := a.register("course-owner@example.com")
	other := a.register("course-other@example.com")
	created := a.request(owner, "POST", "/courses", map[string]any{
		"title": "只属于我的课程",
		"topic": "隐私",
		"cover": map[string]any{"motif": "abstract", "palette": "sunrise", "label": "PRIVATE"},
	}, http.StatusCreated)["course"].(map[string]any)
	id := created["id"].(string)

	a.request(other, "GET", "/courses/"+id, nil, http.StatusNotFound)
	a.request(other, "PATCH", "/courses/"+id, map[string]any{"title": "越权修改"}, http.StatusNotFound)
	a.request(other, "DELETE", "/courses/"+id, nil, http.StatusNotFound)
	listed := a.request(other, "GET", "/courses", nil, http.StatusOK)["courses"].([]any)
	if len(listed) != 0 {
		t.Fatalf("another student's course leaked: %v", listed)
	}
}
