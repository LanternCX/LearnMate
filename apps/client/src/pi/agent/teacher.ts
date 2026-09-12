import type {
  ModelInfo,
  ModelRetryListener,
  CourseMessage,
} from "../../domain/learning";
import type { ModelGateway } from "../gateway";
import { createAgent } from "../agent";
import type {
  CourseManagement,
  SlideTools,
  TeachingToolContext,
} from "../tool";
import {
  createCourseTool,
  activityLabel as createCourseLabel,
} from "../tools/create_course";
import {
  renameCourseTool,
  activityLabel as renameCourseLabel,
} from "../tools/rename_course";
import {
  createSlidesTool,
  activityLabel as createSlidesLabel,
} from "../tools/create_slides";
import {
  showNextSlideTool,
  activityLabel as showNextSlideLabel,
} from "../tools/show_next_slide";
import {
  readSlidesTool,
  activityLabel as readSlidesLabel,
} from "../tools/read_slides";
import {
  cancelSlidesTool,
  activityLabel as cancelSlidesLabel,
} from "../tools/cancel_slides";

function teacherPrompt(
  course: { id: string; title: string; topic: string },
  messages: CourseMessage[],
  memory: string,
) {
  return `You are Zhiya, a K12 learning companion and the sole controller of lesson playback. ${course.id ? `Continue the active course ${JSON.stringify({ title: course.title, topic: course.topic })}.` : "Before teaching, you MUST call create_course exactly once using the student's first learning request. You decide the concise course title, stable topic, and an editorial cover direction; do not ask for confirmation. Choose a motif that genuinely matches the subject, vary palettes between courses, and write a compact subject label such as COMPUTING · 01 rather than repeating the title."} Start teaching immediately from whatever learning context the student provides. The student's explicit request for lesson pace and page count takes priority. Generate the number of pages the student requests; when no count is given, choose an appropriate batch from the current request and learning memory. Use create_slides to prepare those visual pages in the background. Its first returned page is visible. Keep playback and narration synchronized: show one page, explain that page with concise Markdown, and only then call show_next_slide. If the student asks for continuous teaching, repeat this cycle and do not wait for confirmation until the requested batch is complete or the student interrupts. If the student asks for one page at a time, explain the current page and wait for the student before advancing. Never advance while explaining, describe a page that is merely generated but not visible, or promise to continue without actually calling show_next_slide when another requested page remains. Do not require outline confirmation. When feedback changes unfinished material, replace it; ordinary questions may leave preparation running. Speak the student's language.\nPrevious course transcript:\n${JSON.stringify(messages.map(({ role, text }) => ({ role, text })))}\nStudent learning memory:\n${memory || "No saved preferences yet."}`;
}

export function createTeacherAgent(options: {
  model: ModelInfo;
  gateway: ModelGateway;
  memory: string;
  messages: CourseMessage[];
  management: CourseManagement;
  slides: SlideTools;
  onRetry: ModelRetryListener;
}) {
  const initial = options.management.course;
  const context: TeachingToolContext = {
    course: {
      id: initial?.id ?? "",
      title: initial?.title ?? "",
      topic: initial?.topic ?? "",
    },
    management: options.management,
  };
  return createAgent({
    model: options.model,
    tools: [
      createCourseTool(context),
      renameCourseTool(context),
      createSlidesTool(options.slides.start),
      showNextSlideTool(options.slides.next),
      readSlidesTool(options.slides.read),
      cancelSlidesTool(options.slides.cancel),
    ],
    systemPrompt: teacherPrompt(context.course, options.messages, options.memory),
    request: (payload, signal) => {
      payload.parallel_tool_calls = false;
      return options.gateway.course("teacher", payload, signal, options.onRetry);
    },
  });
}

export function teacherToolLabel(name: string) {
  return ({
    create_course: createCourseLabel,
    rename_course: renameCourseLabel,
    create_slides: createSlidesLabel,
    show_next_slide: showNextSlideLabel,
    read_slides: readSlidesLabel,
    cancel_slides: cancelSlidesLabel,
  })[name] ?? "使用教学工具";
}
