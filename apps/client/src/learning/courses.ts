import { api } from "../api";
import type { CourseMessage, Slide } from "./course";

export type CourseConversationState = {
  messages: CourseMessage[];
  slides: Slide[];
  presentedSlideIds: string[];
  currentSlideId: string;
};

export type CourseCover = {
  motif:
    | "code"
    | "orbit"
    | "geometry"
    | "language"
    | "nature"
    | "history"
    | "abstract";
  palette: "sprout" | "sunrise" | "ocean" | "berry" | "clay";
  label: string;
};

export type StoredCourse = {
  id: string;
  conversationId: string;
  title: string;
  topic: string;
  cover: CourseCover;
  status: "active";
  state: CourseConversationState;
  createdAt: string;
  updatedAt: string;
};

export const emptyCourseState = (): CourseConversationState => ({
  messages: [],
  slides: [],
  presentedSlideIds: [],
  currentSlideId: "",
});

export async function listCourses() {
  return (await api<{ courses: StoredCourse[] }>("/courses")).courses;
}

export async function createCourse(
  title: string,
  topic: string,
  cover: CourseCover,
) {
  return (
    await api<{ course: StoredCourse }>("/courses", "POST", {
      title,
      topic,
      cover,
    })
  ).course;
}

export async function updateCourse(
  id: string,
  changes: { title?: string; topic?: string },
) {
  return (
    await api<{ course: StoredCourse }>(`/courses/${id}`, "PATCH", changes)
  ).course;
}

export async function deleteCourse(id: string) {
  await api(`/courses/${id}`, "DELETE");
}

export async function saveCourseConversation(
  course: StoredCourse,
  state: CourseConversationState,
) {
  await api(`/courses/${course.id}/conversation`, "PUT", {
    conversationId: course.conversationId,
    state,
  });
}
