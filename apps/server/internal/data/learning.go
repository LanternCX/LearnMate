package data

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"time"
)

type Question struct {
	ID          string   `json:"id"`
	Text        string   `json:"text"`
	Description string   `json:"description,omitempty"`
	Kind        string   `json:"kind"`
	Options     []string `json:"options"`
}

type Conversation struct {
	ID              string            `json:"id"`
	Purpose         string            `json:"purpose"`
	Messages        []json.RawMessage `json:"messages"`
	Question        *Question         `json:"question"`
	Completed       bool              `json:"completed"`
	CorrectionEnded bool              `json:"correctionEnded"`
	Memory          string            `json:"memory"`
	MemoryVersion   int               `json:"memoryVersion"`
	Revision        int               `json:"revision"`
	Status          string            `json:"status"`
	RunID           string            `json:"runId,omitempty"`
	Inference       bool              `json:"inference"`
	LeaseUntil      time.Time         `json:"leaseUntil"`
}

type LearningModel struct{ db database }

func UUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// Load and Save are used inside the authenticated transaction. The row lock
// serializes actions from all devices without holding a transaction across inference.
func (m LearningModel) Load(ctx context.Context, user string) (Conversation, error) {
	initial := Conversation{ID: UUID(), Purpose: "onboarding", Messages: []json.RawMessage{}, Status: "idle"}
	raw, _ := json.Marshal(initial)
	_, err := m.db.Exec(ctx, `INSERT INTO conversations(id,user_id,purpose,state) VALUES($1,$2,'onboarding',$3) ON CONFLICT(user_id,purpose) DO NOTHING`, initial.ID, user, raw)
	if err != nil {
		return Conversation{}, err
	}
	err = m.db.QueryRow(ctx, `SELECT state FROM conversations WHERE user_id=$1 AND purpose='onboarding' FOR UPDATE`, user).Scan(&raw)
	if err != nil {
		return Conversation{}, err
	}
	var c Conversation
	err = json.Unmarshal(raw, &c)
	if err != nil {
		return c, err
	}
	_, err = m.db.Exec(ctx, `INSERT INTO student_memories(user_id) VALUES($1) ON CONFLICT DO NOTHING`, user)
	if err != nil {
		return c, err
	}
	err = m.db.QueryRow(ctx, `SELECT content,version FROM student_memories WHERE user_id=$1 FOR UPDATE`, user).Scan(&c.Memory, &c.MemoryVersion)
	return c, err
}

func (m LearningModel) Save(ctx context.Context, user string, c *Conversation) error {
	c.Revision++
	stored := *c
	stored.Memory = ""
	stored.MemoryVersion = 0
	raw, err := json.Marshal(stored)
	if err != nil {
		return err
	}
	_, err = m.db.Exec(ctx, `UPDATE conversations SET state=$1 WHERE user_id=$2 AND id=$3`, raw, user, c.ID)
	if err != nil {
		return err
	}
	_, err = m.db.Exec(ctx, `UPDATE student_memories SET content=$1,version=$2,updated_at=now() WHERE user_id=$3 AND version<>$2`, c.Memory, c.MemoryVersion, user)
	return err
}
