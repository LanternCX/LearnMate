package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/LanternCX/zhiya/apps/server/internal/data"
)

type learningAction struct {
	Action     string          `json:"action"`
	RunID      string          `json:"runId"`
	Message    json.RawMessage `json:"message"`
	ToolCallID string          `json:"toolCallId"`
	Answer     *studentAnswer  `json:"answer"`
}
type studentAnswer struct {
	Selected []string `json:"selected"`
	Text     string   `json:"text"`
	Skipped  bool     `json:"skipped"`
}
type savedMessage struct {
	Role       string          `json:"role"`
	Content    json.RawMessage `json:"content"`
	ToolCallID string          `json:"toolCallId"`
}
type savedCall struct {
	Type      string          `json:"type"`
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

const runLease = 45 * time.Second

// Long polling works over the same authenticated HTTP bridge on web and desktop.
// A request returns as soon as the persisted revision changes, including changes
// written through another server instance.
func (a *application) learningSync(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Revision int `json:"revision"`
	}
	if err := a.readJSON(w, r, &input); err != nil {
		a.respondError(w, err)
		return
	}
	deadline := time.NewTimer(10 * time.Second)
	defer deadline.Stop()
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()
	for {
		var state data.Conversation
		err := a.withUser(r, data.StandardTransaction, func(m data.Models, u data.User) error {
			var err error
			state, err = m.Learning.Load(r.Context(), u.ID)
			return err
		})
		if err != nil {
			a.respondError(w, err)
			return
		}
		state.RunID = ""
		if state.Revision != input.Revision {
			writeJSON(w, 200, state)
			return
		}
		select {
		case <-r.Context().Done():
			return
		case <-deadline.C:
			writeJSON(w, 200, state)
			return
		case <-ticker.C:
		}
	}
}

func (a *application) learningAction(w http.ResponseWriter, r *http.Request) {
	var input learningAction
	if err := a.readJSON(w, r, &input); err != nil {
		a.respondError(w, err)
		return
	}
	var state data.Conversation
	var output any
	err := a.withUser(r, data.StandardTransaction, func(m data.Models, u data.User) error {
		var err error
		state, err = m.Learning.Load(r.Context(), u.ID)
		if err != nil {
			return err
		}
		switch input.Action {
		case "claim":
			if state.RunID != "" && time.Now().Before(state.LeaseUntil) {
				return failure{409, "正在处理中，请稍候"}
			}
			state.RunID = data.UUID()
			state.Inference = false
			state.LeaseUntil = time.Now().Add(runLease)
			if state.Question != nil {
				state.Status = "waiting"
			} else {
				state.Status = "running"
			}
			output = map[string]string{"runId": state.RunID}
		case "answer":
			if state.Question == nil || input.ToolCallID != state.Question.ID {
				return failure{409, "这道问题已更新，请查看最新内容"}
			}
			if input.Answer == nil {
				return bad("请提交回答")
			}
			if err = validateAnswer(state.Question, input.Answer); err != nil {
				return err
			}
			appendToolResult(&state, input.ToolCallID, "ask_student", input.Answer, false)
			state.Question = nil
			state.Status = "running"
		default:
			if input.RunID == "" || input.RunID != state.RunID || time.Now().After(state.LeaseUntil) {
				return failure{409, "本轮执行已中断，请恢复会话"}
			}
			if !state.Inference {
				state.LeaseUntil = time.Now().Add(runLease)
			}
			switch input.Action {
			case "heartbeat":
			case "release":
				state.RunID = ""
				state.LeaseUntil = time.Time{}
				if state.Question != nil {
					state.Status = "waiting"
				} else {
					state.Status = "idle"
				}
			case "message":
				if state.Inference {
					return failure{409, "模型仍在生成，请稍候"}
				}
				if len(state.Messages) > 0 {
					var previous, current any
					_ = json.Unmarshal(state.Messages[len(state.Messages)-1], &previous)
					_ = json.Unmarshal(input.Message, &current)
					previousJSON, _ := json.Marshal(previous)
					currentJSON, _ := json.Marshal(current)
					if bytes.Equal(previousJSON, currentJSON) {
						break
					}
				}
				var msg savedMessage
				if json.Unmarshal(input.Message, &msg) != nil || (msg.Role != "assistant" && msg.Role != "user") {
					return bad("消息格式无效")
				}
				if state.Question != nil {
					return failure{409, "请先回答当前问题"}
				}
				if firstPendingCall(&state) != "" {
					return failure{409, "请先完成当前工具调用"}
				}
				if msg.Role == "assistant" {
					var blocks []savedCall
					if json.Unmarshal(msg.Content, &blocks) != nil {
						return bad("模型消息格式无效")
					}
					seen := map[string]bool{}
					for _, b := range blocks {
						if b.Type == "toolCall" {
							if b.ID == "" || seen[b.ID] || findCall(&state, b.ID) != nil {
								return bad("工具调用标识重复或无效")
							}
							seen[b.ID] = true
						}
					}
				}
				// A repeated save after a lost HTTP response must not duplicate the message.
				if len(state.Messages) == 0 || !bytes.Equal(state.Messages[len(state.Messages)-1], input.Message) {
					state.Messages = append(state.Messages, input.Message)
				}
			case "tool_error":
				call := findCall(&state, input.ToolCallID)
				if call == nil || firstPendingCall(&state) != input.ToolCallID || state.Question != nil {
					return failure{409, "工具状态已变化"}
				}
				appendToolResult(&state, call.ID, call.Name, map[string]string{"error": "工具参数未通过客户端校验，请检查工具定义后重试"}, true)
			case "tool":
				if state.Inference {
					return failure{409, "模型仍在生成，请稍候"}
				}
				if state.Question != nil && state.Question.ID == input.ToolCallID {
					output = map[string]any{"waiting": true}
					break
				}
				if result := findResult(&state, input.ToolCallID); result != nil {
					output = map[string]any{"result": result}
					break
				}
				call := findCall(&state, input.ToolCallID)
				if call == nil {
					return bad("找不到对应的工具调用")
				}
				// Calls are executed in the assistant's order, including after restoration.
				if firstPendingCall(&state) != input.ToolCallID {
					return failure{409, "请按会话顺序执行工具"}
				}
				result, toolErr := executeLearningTool(&state, *call)
				if toolErr != nil {
					appendToolResult(&state, call.ID, call.Name, map[string]string{"error": toolErr.Error()}, true)
				} else if state.Question == nil {
					appendToolResult(&state, call.ID, call.Name, result, false)
				}
				if state.Question != nil {
					output = map[string]any{"waiting": true}
				} else {
					output = map[string]any{"result": findResult(&state, call.ID)}
				}
			default:
				return bad("未知会话操作")
			}
		}
		return m.Learning.Save(r.Context(), u.ID, &state)
	})
	if err != nil {
		a.respondError(w, err)
		return
	}
	if output != nil {
		writeJSON(w, 200, output)
		return
	}
	state.RunID = ""
	writeJSON(w, 200, state)
}

func validateAnswer(q *data.Question, a *studentAnswer) error {
	if len(a.Text) > 4000 {
		return bad("回答太长，请简短一些")
	}
	if a.Skipped {
		if len(a.Selected) > 0 || a.Text != "" {
			return bad("跳过时无需提交答案")
		}
		return nil
	}
	if len(a.Selected) == 0 && strings.TrimSpace(a.Text) == "" {
		return bad("请选择或填写回答")
	}
	if (q.Kind == "single" && len(a.Selected) > 1) || (q.Kind == "text" && len(a.Selected) > 0) {
		return bad("回答方式不符合当前问题")
	}
	seen := map[string]bool{}
	for _, v := range a.Selected {
		valid := false
		for _, o := range q.Options {
			if o == v {
				valid = true
			}
		}
		if !valid || seen[v] {
			return bad("选项无效，请查看最新问题")
		}
		seen[v] = true
	}
	return nil
}

func findCall(c *data.Conversation, id string) *savedCall {
	for _, raw := range c.Messages {
		var msg savedMessage
		_ = json.Unmarshal(raw, &msg)
		if msg.Role != "assistant" {
			continue
		}
		var blocks []savedCall
		_ = json.Unmarshal(msg.Content, &blocks)
		for _, b := range blocks {
			if b.Type == "toolCall" && b.ID == id {
				return &b
			}
		}
	}
	return nil
}
func findResult(c *data.Conversation, id string) json.RawMessage {
	for _, raw := range c.Messages {
		var m savedMessage
		_ = json.Unmarshal(raw, &m)
		if m.Role == "toolResult" && m.ToolCallID == id {
			return raw
		}
	}
	return nil
}
func firstPendingCall(c *data.Conversation) string {
	for _, raw := range c.Messages {
		var m savedMessage
		_ = json.Unmarshal(raw, &m)
		if m.Role != "assistant" {
			continue
		}
		var blocks []savedCall
		_ = json.Unmarshal(m.Content, &blocks)
		for _, b := range blocks {
			if b.Type == "toolCall" && findResult(c, b.ID) == nil {
				return b.ID
			}
		}
	}
	return ""
}
func appendToolResult(c *data.Conversation, id, name string, result any, isError bool) {
	value, _ := json.Marshal(result)
	raw, _ := json.Marshal(map[string]any{"role": "toolResult", "toolCallId": id, "toolName": name, "content": []any{map[string]string{"type": "text", "text": string(value)}}, "details": result, "isError": isError, "timestamp": time.Now().UnixMilli()})
	c.Messages = append(c.Messages, raw)
}
func executeLearningTool(c *data.Conversation, call savedCall) (any, error) {
	switch call.Name {
	case "ask_student":
		if c.Question != nil {
			return nil, errors.New("已有问题等待回答")
		}
		var q data.Question
		if json.Unmarshal(call.Arguments, &q) != nil || strings.TrimSpace(q.Text) == "" || len(q.Text) > 2000 || len(q.Description) > 4000 {
			return nil, errors.New("请提供一个简短、明确的问题")
		}
		if q.Kind != "single" && q.Kind != "multiple" && q.Kind != "text" {
			return nil, errors.New("问题类型应为 single、multiple 或 text")
		}
		if q.Kind != "text" && (len(q.Options) < 2 || len(q.Options) > 8) {
			return nil, errors.New("选择题需提供 2–8 个选项")
		}
		seen := map[string]bool{}
		for _, s := range q.Options {
			if strings.TrimSpace(s) == "" || len(s) > 500 || seen[s] {
				return nil, errors.New("选项应简短、不重复")
			}
			seen[s] = true
		}
		q.ID = call.ID
		c.Question = &q
		c.Status = "waiting"
		return nil, nil
	case "read_memory":
		return map[string]any{"content": c.Memory, "version": c.MemoryVersion}, nil
	case "update_memory":
		var v struct {
			Content string `json:"content"`
			Version int    `json:"version"`
		}
		if json.Unmarshal(call.Arguments, &v) != nil || len(v.Content) > 32000 {
			return nil, errors.New("记忆内容无效或过长")
		}
		if v.Version != c.MemoryVersion {
			return nil, errors.New("记忆版本已变化，请先读取最新记忆")
		}
		c.Memory = v.Content
		c.MemoryVersion++
		return map[string]any{"content": c.Memory, "version": c.MemoryVersion}, nil
	case "complete_onboarding":
		c.Completed = true
		return map[string]bool{"completed": true}, nil
	default:
		return nil, errors.New("未知工具")
	}
}

func (a *application) learning(w http.ResponseWriter, r *http.Request) {
	var state data.Conversation
	err := a.withUser(r, data.StandardTransaction, func(m data.Models, u data.User) error {
		var err error
		state, err = m.Learning.Load(r.Context(), u.ID)
		return err
	})
	if err != nil {
		a.respondError(w, err)
		return
	}
	state.RunID = ""
	writeJSON(w, 200, state)
}
