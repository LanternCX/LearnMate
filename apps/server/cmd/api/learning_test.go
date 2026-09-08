package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestModelProxyUsesServerCredentialsAndRequiresExecution(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer server-secret" {
			t.Error("missing server credential")
		}
		var payload map[string]any
		_ = json.NewDecoder(r.Body).Decode(&payload)
		if payload["model"] != "configured-model" {
			t.Error("client selected model")
		}
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, "data: [DONE]\n\n")
	}))
	defer upstream.Close()
	t.Setenv("ZHIYA_SERVER_MODEL_ENDPOINT", upstream.URL)
	t.Setenv("ZHIYA_SERVER_MODEL_ID", "configured-model")
	t.Setenv("ZHIYA_SERVER_MODEL_API_KEY", "server-secret")
	a := setupAccountTest(t)
	c := a.register("proxy@example.com")
	a.request(c, "POST", "/learning/model", map[string]any{"runId": "invalid", "payload": map[string]any{}}, 409)
	run := a.request(c, "POST", "/learning/action", map[string]any{"action": "claim"}, 200)["runId"].(string)
	body, _ := json.Marshal(map[string]any{"runId": run, "payload": map[string]any{"model": "client-model", "messages": []any{}, "stream": true}})
	req, _ := http.NewRequest("POST", a.server.URL+"/api/learning/model", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Zhiya-Request", "1")
	res, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode != 200 || string(raw) != "data: [DONE]\n\n" {
		t.Fatalf("proxy: %d %s", res.StatusCode, raw)
	}
}

func TestLearningSyncObservesAnotherDevice(t *testing.T) {
	a := setupAccountTest(t)
	c := a.register("sync@example.com")
	state := a.request(c, "GET", "/learning", nil, 200)
	done := make(chan map[string]any, 1)
	go func() {
		done <- a.request(c, "POST", "/learning/sync", map[string]any{"revision": state["revision"]}, 200)
	}()
	a.request(c, "POST", "/learning/action", map[string]any{"action": "claim"}, 200)
	select {
	case updated := <-done:
		if updated["status"] != "running" {
			t.Fatal(updated)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("other device did not receive updated state")
	}
}

func toolMessage(id, name string, arguments any) map[string]any {
	return map[string]any{"role": "assistant", "content": []any{map[string]any{"type": "toolCall", "id": id, "name": name, "arguments": arguments}}, "stopReason": "toolUse", "timestamp": 1}
}

func TestOnboardingAnswersResumeAndToolsAreIdempotent(t *testing.T) {
	a := setupAccountTest(t)
	c := a.register("tools@example.com")
	other := a.client()
	a.request(other, "POST", "/auth/login", map[string]string{"email": "tools@example.com", "password": testPassword}, 200)
	run := a.request(c, "POST", "/learning/action", map[string]any{"action": "claim"}, 200)["runId"].(string)
	a.request(other, "POST", "/learning/action", map[string]any{"action": "claim"}, 409)
	action := func(kind string, extra map[string]any) map[string]any {
		extra["action"] = kind
		extra["runId"] = run
		return a.request(c, "POST", "/learning/action", extra, 200)
	}
	action("message", map[string]any{"message": toolMessage("ask-1", "ask_student", map[string]any{"text": "你用过 Scratch 吗？", "kind": "single", "options": []string{"用过", "没用过"}})})
	action("tool", map[string]any{"toolCallId": "ask-1"})
	state := a.request(other, "GET", "/learning", nil, 200)
	if state["status"] != "waiting" {
		t.Fatal(state)
	}
	answer := map[string]any{"action": "answer", "toolCallId": "ask-1", "answer": map[string]any{"selected": []string{"用过"}, "text": "做过小游戏", "skipped": false}}
	a.request(other, "POST", "/learning/action", answer, 200)
	a.request(c, "POST", "/learning/action", answer, 409)
	action("tool", map[string]any{"toolCallId": "ask-1"})
	action("message", map[string]any{"message": toolMessage("save-1", "update_memory", map[string]any{"content": "学过 Scratch，做过小游戏。", "version": 0})})
	action("tool", map[string]any{"toolCallId": "save-1"})
	action("tool", map[string]any{"toolCallId": "save-1"})
	action("release", map[string]any{})
	state = a.request(other, "GET", "/learning", nil, 200)
	if state["memoryVersion"] != float64(1) || state["memory"] != "学过 Scratch，做过小游戏。" {
		t.Fatal(state)
	}
	if state["completed"] != false {
		t.Fatal("final response must not complete onboarding")
	}
	run = a.request(other, "POST", "/learning/action", map[string]any{"action": "claim"}, 200)["runId"].(string)
	action("message", map[string]any{"message": toolMessage("done-1", "complete_onboarding", map[string]any{})})
	action("tool", map[string]any{"toolCallId": "done-1"})
	state = a.request(other, "GET", "/learning", nil, 200)
	if state["completed"] != true {
		t.Fatal(state)
	}
	raw, _ := json.Marshal(state["messages"])
	if len(raw) == 0 || state["question"] != nil {
		t.Fatal(state)
	}
}

func TestOnboardingIsPersistentAndPrivate(t *testing.T) {
	a := setupAccountTest(t)
	alice := a.register("alice-learning@example.com")
	first := a.request(alice, "GET", "/learning", nil, http.StatusOK)
	if first["purpose"] != "onboarding" || first["completed"] != false {
		t.Fatalf("unexpected onboarding: %v", first)
	}
	id, ok := first["id"].(string)
	if !ok || len(id) != 36 {
		t.Fatalf("expected UUID, got %v", first["id"])
	}
	second := a.request(alice, "GET", "/learning", nil, http.StatusOK)
	if second["id"] != id {
		t.Fatal("loading created a second onboarding")
	}
	bob := a.register("bob-learning@example.com")
	other := a.request(bob, "GET", "/learning", nil, http.StatusOK)
	if other["id"] == id {
		t.Fatal("students share a conversation")
	}
	a.request(a.client(), "GET", "/learning", nil, http.StatusUnauthorized)
}

func TestInterruptedQuestionRestoresWithoutExecutingItTwice(t *testing.T) {
	a := setupAccountTest(t)
	c := a.register("restore@example.com")
	old := a.request(c, "POST", "/learning/action", map[string]any{"action": "claim"}, 200)["runId"].(string)
	a.request(c, "POST", "/learning/action", map[string]any{"action": "message", "runId": old, "message": toolMessage("restore-q", "ask_student", map[string]any{"text": "你试过自己写程序吗？", "kind": "text", "options": []string{}})}, 200)
	a.request(c, "POST", "/learning/action", map[string]any{"action": "tool", "runId": old, "toolCallId": "restore-q"}, 200)
	a.request(c, "POST", "/learning/action", map[string]any{"action": "release", "runId": old}, 200)
	next := a.request(c, "POST", "/learning/action", map[string]any{"action": "claim"}, 200)["runId"].(string)
	a.request(c, "POST", "/learning/action", map[string]any{"action": "release", "runId": old}, 409)
	result := a.request(c, "POST", "/learning/action", map[string]any{"action": "tool", "runId": next, "toolCallId": "restore-q"}, 200)
	if result["waiting"] != true {
		t.Fatal(result)
	}
	state := a.request(c, "GET", "/learning", nil, 200)
	if len(state["messages"].([]any)) != 1 {
		t.Fatalf("resuming fabricated a result: %v", state)
	}
}
