import { api } from "../../api";
import type {
  CourseConversationState,
  CourseCover,
  StoredCourse,
} from "../../domain/learning";

export const emptyCourseState = (): CourseConversationState => ({
  messages: [],
  pages: [],
  presentedPageIds: [],
  currentPageId: "",
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
