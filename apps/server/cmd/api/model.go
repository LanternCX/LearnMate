package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/LanternCX/zhiya/apps/server/internal/data"
)

func (a *application) modelInfo(w http.ResponseWriter, r *http.Request) {
	err := a.withUser(r, data.StandardTransaction, func(_ data.Models, _ data.User) error { return nil })
	if err != nil {
		a.respondError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"id": a.config.Model.ID, "available": a.config.Model.Endpoint != ""})
}

func (a *application) modelProxy(w http.ResponseWriter, r *http.Request) {
	var input struct {
		RunID   string         `json:"runId"`
		Payload map[string]any `json:"payload"`
	}
	if err := a.readJSON(w, r, &input); err != nil {
		a.respondError(w, err)
		return
	}
	var user string
	err := a.withUser(r, data.StandardTransaction, func(m data.Models, u data.User) error {
		c, err := m.Learning.LoadForAction(r.Context(), u.ID)
		if err != nil {
			return err
		}
		if input.RunID == "" || c.RunID != input.RunID || time.Now().After(c.LeaseUntil) || c.Inference || c.Question != nil || firstPendingCall(&c) != "" {
			return failure{409, "会话状态已变化，请恢复后继续"}
		}
		if a.config.Model.Endpoint == "" {
			return failure{503, "知芽暂时无法开始交流，请稍后重试"}
		}
		c.Inference = true
		c.LeaseUntil = time.Now().Add(150 * time.Second)
		user = u.ID
		return m.Learning.Save(r.Context(), u.ID, &c)
	})
	if err != nil {
		a.respondError(w, err)
		return
	}
	var finished sync.Once
	completed := false
	finish := func() {
		finished.Do(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = a.models.Transaction(ctx, data.StandardTransaction, func(m data.Models) error {
				c, err := m.Learning.Load(ctx, user)
				if err != nil {
					return err
				}
				if c.RunID != input.RunID {
					return nil
				}
				c.Inference = false
				if completed {
					c.LeaseUntil = time.Now().Add(runLease)
				} else {
					c.RunID = ""
					c.LeaseUntil = time.Time{}
					if c.Question != nil {
						c.Status = "waiting"
					} else {
						c.Status = "idle"
					}
				}
				return m.Learning.Save(ctx, user, &c)
			})
		})
	}
	defer finish()
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	unregister := a.learningHub.registerExecution(user, input.RunID, cancel)
	defer unregister()
	if current, snapshotErr := a.models.Learning.Snapshot(ctx, user, 1<<30); snapshotErr != nil || current.RunID != input.RunID {
		cancel()
	}
	completed = a.streamModel(ctx, w, r, input.Payload, "", finish)
	return
}

func (a *application) courseModelProxy(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Agent   string         `json:"agent"`
		Payload map[string]any `json:"payload"`
	}
	if err := a.readJSON(w, r, &input); err != nil {
		a.respondError(w, err)
		return
	}
	if input.Agent != "teacher" && input.Agent != "slides" {
		a.respondError(w, bad("课堂 Agent 无效"))
		return
	}
	if err := a.withUser(r, data.StandardTransaction, func(_ data.Models, _ data.User) error {
		if a.config.Model.Endpoint == "" {
			return failure{503, "知芽暂时无法开始教学，请稍后重试"}
		}
		return nil
	}); err != nil {
		a.respondError(w, err)
		return
	}
	a.streamModel(r.Context(), w, r, input.Payload, input.Agent, nil)
}

func (a *application) streamModel(ctx context.Context, w http.ResponseWriter, r *http.Request, payload map[string]any, agent string, onDone func()) bool {
	if payload == nil {
		a.respondError(w, bad("模型请求无效"))
		return false
	}
	payload["model"] = a.config.Model.ID
	payload["stream"] = true
	payload["store"] = false
	delete(payload, "max_tokens")
	payload["max_completion_tokens"] = 8192
	raw, _ := json.Marshal(payload)
	upstream, err := http.NewRequestWithContext(ctx, "POST", a.config.Model.Endpoint, bytes.NewReader(raw))
	if err != nil {
		a.respondError(w, failure{502, "暂时无法连接模型服务"})
		return false
	}
	upstream.Header.Set("Content-Type", "application/json")
	upstream.Header.Set("Authorization", "Bearer "+a.config.Model.APIKey)
	if agent != "" {
		upstream.Header.Set("X-Zhiya-Agent", agent)
	}
	client := &http.Client{Timeout: 120 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(upstream)
	if err != nil {
		a.respondError(w, failure{502, "暂时无法连接模型服务，请重试"})
		return false
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		a.respondError(w, failure{502, "模型服务暂时不可用，请稍后重试"})
		return false
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("X-Accel-Buffering", "no")
	reader := bufio.NewReader(response.Body)
	completed := false
	for {
		line, readErr := reader.ReadString('\n')
		// Clear inference before the terminal event reaches Pi: it can immediately
		// persist the assistant message and execute its next tool.
		if strings.TrimSpace(line) == "data: [DONE]" {
			completed = true
			if onDone != nil {
				onDone()
			}
		}
		if len(line) > 0 {
			if _, err = w.Write([]byte(line)); err != nil {
				return false
			}
			_ = http.NewResponseController(w).Flush()
		}
		if readErr != nil {
			return completed
		}
	}
}
