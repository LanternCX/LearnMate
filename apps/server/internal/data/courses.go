package data

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
)

type Course struct {
	ID             string          `json:"id"`
	ConversationID string          `json:"conversationId"`
	Title          string          `json:"title"`
	Topic          string          `json:"topic"`
	Cover          CourseCover     `json:"cover"`
	Status         string          `json:"status"`
	State          json.RawMessage `json:"state"`
	CreatedAt      time.Time       `json:"createdAt"`
	UpdatedAt      time.Time       `json:"updatedAt"`
}

type CourseCover struct {
	Motif   string `json:"motif"`
	Palette string `json:"palette"`
	Label   string `json:"label"`
}

type CourseModel struct{ db database }

var emptyCourseState = json.RawMessage(`{"messages":[],"slides":[],"presentedSlideIds":[],"currentSlideId":""}`)

func scanCourse(row pgx.Row) (Course, error) {
	var course Course
	err := row.Scan(
		&course.ID,
		&course.ConversationID,
		&course.Title,
		&course.Topic,
		&course.Cover.Motif,
		&course.Cover.Palette,
		&course.Cover.Label,
		&course.Status,
		&course.State,
		&course.CreatedAt,
		&course.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return Course{}, ErrCourseNotFound
	}
	return course, err
}

const courseSelect = `SELECT c.id,cc.id,c.title,c.topic,c.cover_motif,c.cover_palette,c.cover_label,c.status,cc.state,c.created_at,c.updated_at
 FROM courses c
 JOIN LATERAL (
  SELECT id,state FROM course_conversations
  WHERE course_id=c.id ORDER BY created_at LIMIT 1
 ) cc ON true`

func (m CourseModel) Create(ctx context.Context, user, title, topic string, cover CourseCover) (Course, error) {
	courseID := UUID()
	conversationID := UUID()
	if _, err := m.db.Exec(ctx, `INSERT INTO courses(id,user_id,title,topic,cover_motif,cover_palette,cover_label) VALUES($1,$2,$3,$4,$5,$6,$7)`, courseID, user, title, topic, cover.Motif, cover.Palette, cover.Label); err != nil {
		return Course{}, err
	}
	if _, err := m.db.Exec(ctx, `INSERT INTO course_conversations(id,course_id,state) VALUES($1,$2,$3)`, conversationID, courseID, emptyCourseState); err != nil {
		return Course{}, err
	}
	return m.Get(ctx, user, courseID)
}

func (m CourseModel) List(ctx context.Context, user string) ([]Course, error) {
	rows, err := m.db.Query(ctx, courseSelect+` WHERE c.user_id=$1 ORDER BY c.updated_at DESC`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	courses := []Course{}
	for rows.Next() {
		course, err := scanCourse(rows)
		if err != nil {
			return nil, err
		}
		courses = append(courses, course)
	}
	return courses, rows.Err()
}

func (m CourseModel) Get(ctx context.Context, user, id string) (Course, error) {
	return scanCourse(m.db.QueryRow(ctx, courseSelect+` WHERE c.user_id=$1 AND c.id=$2`, user, id))
}

func (m CourseModel) Update(ctx context.Context, user, id, title, topic string) (Course, error) {
	tag, err := m.db.Exec(ctx, `UPDATE courses SET title=$1,topic=$2,updated_at=now() WHERE user_id=$3 AND id=$4`, title, topic, user, id)
	if err != nil {
		return Course{}, err
	}
	if tag.RowsAffected() == 0 {
		return Course{}, ErrCourseNotFound
	}
	return m.Get(ctx, user, id)
}

func (m CourseModel) SaveConversation(ctx context.Context, user, courseID, conversationID string, state json.RawMessage) error {
	tag, err := m.db.Exec(ctx, `UPDATE course_conversations cc SET state=$1,updated_at=now()
 FROM courses c WHERE cc.course_id=c.id AND c.user_id=$2 AND c.id=$3 AND cc.id=$4`, state, user, courseID, conversationID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrCourseNotFound
	}
	_, err = m.db.Exec(ctx, `UPDATE courses SET updated_at=now() WHERE user_id=$1 AND id=$2`, user, courseID)
	return err
}

func (m CourseModel) Delete(ctx context.Context, user, id string) error {
	tag, err := m.db.Exec(ctx, `DELETE FROM courses WHERE user_id=$1 AND id=$2`, user, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrCourseNotFound
	}
	return nil
}
