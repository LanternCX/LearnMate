import {
  Agent,
  type AgentTool,
  type StreamFn,
} from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";
import { streamSimple } from "@earendil-works/pi-ai/api/openai-completions";
import { Type } from "typebox";
import {
  courseModelRequest,
  type ModelRetryListener,
  type ModelRetryStatus,
} from "../api";
import type { ModelInfo } from "./session";
import type {
  CourseConversationState,
  CourseCover,
  StoredCourse,
} from "./courses";

export type Slide = {
  id: string;
  title: string;
  kicker?: string;
  body: string;
  bullets: string[];
  layout: "explain" | "steps" | "compare";
};

export type CourseMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  slideId?: string;
};

export type CourseActivity =
  | { kind: "thinking"; text: string; active: boolean }
  | {
      kind: "tool";
      name: string;
      label: string;
      status: "running" | "complete" | "error";
    };

type CourseManagement = {
  course: StoredCourse | null;
  create: (
    title: string,
    topic: string,
    cover: CourseCover,
  ) => Promise<StoredCourse>;
  rename: (title: string, topic?: string) => Promise<StoredCourse>;
};

type SlideRequest = {
  goal: string;
  pageCount: number;
  replaceCurrent: boolean;
};

const modelFor = (info: ModelInfo): Model<"openai-completions"> => ({
  id: info.id,
  name: info.id,
  api: "openai-completions",
  provider: "zhiya",
  baseUrl: "https://zhiya.invalid/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 32768,
  maxTokens: 8192,
});

const streamFor = (
  agent: "teacher" | "slides",
  onRetry: ModelRetryListener,
): StreamFn =>
  (model, context, options) =>
    streamSimple(model as Model<"openai-completions">, context, {
      ...options,
      apiKey: "server-managed",
      maxRetries: 0,
      fetch: async (_url, init) => {
        const payload = JSON.parse(String(init?.body));
        payload.parallel_tool_calls = false;
        return courseModelRequest(
          agent,
          payload,
          init?.signal ?? undefined,
          onRetry,
        );
      },
    });

export class CourseSession {
  private teacher: Agent;
  private slideAgent: Agent | null = null;
  private publishedSlides: Slide[] = [];
  private pendingFirst: { task: number; reject: (error: Error) => void } | null =
    null;
  private slideTask = 0;
  private cancellation = 0;
  private stopped = false;
  private streamingTeacherMessage = false;
  private messageSequence = 0;
  private teacherMessageId = 0;
  private narrationPlayback: {
    id: number;
    promise: Promise<void>;
    resolve: () => void;
  } | null = null;
  private currentSlideId = "";
  private nextSlideWaiter: {
    afterId: string;
    resolve: (slide: Slide) => void;
    reject: (error: Error) => void;
  } | null = null;
  private courseId = "";
  private courseTitle = "";
  private courseTopic = "";
  private modelRetries = new Map<"teacher" | "slides", ModelRetryStatus>();

  constructor(
    info: ModelInfo,
    memory: string,
    private onMessage: (message: CourseMessage, replaceLast?: boolean) => void,
    private onSlides: (slides: Slide[], generating: boolean) => void,
    private onPresent: (slideId: string) => void,
    private onActivity: (activity: CourseActivity | null) => void,
    private onRetry: ModelRetryListener,
    private onError: (message: string) => void,
    initial: CourseConversationState,
    private courseManagement: CourseManagement,
  ) {
    this.publishedSlides = [...initial.slides];
    this.currentSlideId = initial.currentSlideId;
    this.messageSequence = initial.messages.reduce(
      (largest, message) => Math.max(largest, message.id),
      0,
    );
    this.courseId = courseManagement.course?.id ?? "";
    this.courseTitle = courseManagement.course?.title ?? "";
    this.courseTopic = courseManagement.course?.topic ?? "";
    const createCourse: AgentTool = {
      name: "create_course",
      label: "建立课程",
      description:
        "Create the course record before teaching when there is no active course. Choose a concise title and a stable learning topic from the student's request.",
      parameters: Type.Object({
        title: Type.String({ minLength: 1, maxLength: 80 }),
        topic: Type.String({ minLength: 1, maxLength: 240 }),
        cover: Type.Object({
          motif: Type.Union([
            Type.Literal("code"),
            Type.Literal("orbit"),
            Type.Literal("geometry"),
            Type.Literal("language"),
            Type.Literal("nature"),
            Type.Literal("history"),
            Type.Literal("abstract"),
          ]),
          palette: Type.Union([
            Type.Literal("sprout"),
            Type.Literal("sunrise"),
            Type.Literal("ocean"),
            Type.Literal("berry"),
            Type.Literal("clay"),
          ]),
          label: Type.String({ minLength: 1, maxLength: 32 }),
        }),
      }),
      executionMode: "sequential",
      execute: async (_id, params) => {
        const input = params as {
          title: string;
          topic: string;
          cover: CourseCover;
        };
        if (!this.courseId) {
          const created = await this.courseManagement.create(
            String(input.title),
            String(input.topic),
            input.cover,
          );
          this.courseId = created.id;
          this.courseTitle = created.title;
          this.courseTopic = created.topic;
        }
        return {
          content: [
            {
              type: "text",
              text: `The active course is ${JSON.stringify({ id: this.courseId, title: this.courseTitle, topic: this.courseTopic })}.`,
            },
          ],
          details: { courseId: this.courseId },
        };
      },
    };
    const renameCourse: AgentTool = {
      name: "rename_course",
      label: "更新课程",
      description:
        "Rename the active course when the learning direction has materially changed or the student explicitly asks. Do not call for cosmetic wording changes during ordinary teaching.",
      parameters: Type.Object({
        title: Type.String({ minLength: 1, maxLength: 80 }),
        topic: Type.Optional(Type.String({ minLength: 1, maxLength: 240 })),
      }),
      executionMode: "sequential",
      execute: async (_id, params) => {
        const input = params as { title: string; topic?: string };
        if (!this.courseId) throw new Error("Create the course first.");
        const updated = await this.courseManagement.rename(
          String(input.title),
          input.topic === undefined ? undefined : String(input.topic),
        );
        this.courseTitle = updated.title;
        this.courseTopic = updated.topic;
        return {
          content: [
            {
              type: "text",
              text: `Course metadata updated: ${JSON.stringify({ title: updated.title, topic: updated.topic })}.`,
            },
          ],
          details: { courseId: this.courseId },
        };
      },
    };
    const createSlides: AgentTool = {
      name: "create_slides",
      label: "生成课件",
      description:
        "Start generating one or more presentation pages. Use this whenever visual teaching pages help. The first completed page is returned while remaining pages continue in the background.",
      parameters: Type.Object({
        goal: Type.String(),
        pageCount: Type.Integer({ minimum: 1, maximum: 10 }),
        replaceCurrent: Type.Boolean(),
      }),
      executionMode: "sequential",
      execute: async (_id, params) => {
        const first = await this.startSlides(
          info,
          memory,
          params as SlideRequest,
        );
        return {
          content: [
            {
              type: "text",
              text: `The first page is now visible: ${JSON.stringify(first)}. Remaining requested pages continue in the background. Base your explanation on pages that are actually visible.`,
            },
          ],
          details: { first },
        };
      },
    };
    const cancelSlides: AgentTool = {
      name: "cancel_slides",
      label: "停止生成课件",
      description:
        "Cancel the current unfinished slide generation when it conflicts with the student's new direction.",
      parameters: Type.Object({}),
      execute: async () => {
        this.cancelSlides();
        return {
          content: [
            {
              type: "text",
              text: "Unfinished slide generation was cancelled.",
            },
          ],
          details: {},
        };
      },
    };
    const readSlides: AgentTool = {
      name: "read_slides",
      label: "读取当前课件",
      description:
        "Read the pages that are actually visible and whether more pages are still being generated. Use this before referring to pages published after create_slides returned.",
      parameters: Type.Object({}),
      execute: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              pages: this.publishedSlides,
              generating: Boolean(this.slideAgent?.state.isStreaming),
            }),
          },
        ],
        details: { pages: this.publishedSlides.length },
      }),
    };
    const showNextSlide: AgentTool = {
      name: "show_next_slide",
      label: "切换下一页",
      description:
        "Show the next generated page. Call this only after your streamed explanation of the current page is complete. The tool waits if the next page is still being prepared.",
      parameters: Type.Object({}),
      executionMode: "sequential",
      execute: async () => {
        const slide = await this.presentNextSlide();
        return {
          content: [
            {
              type: "text",
              text: `The next page is now visible: ${JSON.stringify(slide)}. Explain only this page before advancing again.`,
            },
          ],
          details: { slide },
        };
      },
    };
    this.teacher = new Agent({
      initialState: {
        model: modelFor(info),
        messages: [],
        tools: [createCourse, renameCourse, createSlides, showNextSlide, readSlides, cancelSlides],
        systemPrompt: `You are Zhiya, a K12 learning companion and the sole controller of lesson playback. ${this.courseId ? `Continue the active course ${JSON.stringify({ title: this.courseTitle, topic: this.courseTopic })}.` : "Before teaching, you MUST call create_course exactly once using the student's first learning request. You decide the concise course title, stable topic, and an editorial cover direction; do not ask for confirmation. Choose a motif that genuinely matches the subject, vary palettes between courses, and write a compact subject label such as COMPUTING · 01 rather than repeating the title."} Start teaching immediately from whatever learning context the student provides. The student's explicit request for lesson pace and page count takes priority. Generate the number of pages the student requests; when no count is given, choose an appropriate batch from the current request and learning memory. Use create_slides to prepare those visual pages in the background. Its first returned page is visible. Keep playback and narration synchronized: show one page, explain that page with concise Markdown, and only then call show_next_slide. If the student asks for continuous teaching, repeat this cycle and do not wait for confirmation until the requested batch is complete or the student interrupts. If the student asks for one page at a time, explain the current page and wait for the student before advancing. Never advance while explaining, describe a page that is merely generated but not visible, or promise to continue without actually calling show_next_slide when another requested page remains. Do not require outline confirmation. When feedback changes unfinished material, replace it; ordinary questions may leave preparation running. Speak the student's language.\nPrevious course transcript:\n${JSON.stringify(initial.messages.map(({ role, text }) => ({ role, text })))}\nStudent learning memory:\n${memory || "No saved preferences yet."}`,
      },
      toolExecution: "sequential",
      streamFn: streamFor("teacher", (status) =>
        this.updateModelRetry("teacher", status),
      ),
    });
    this.teacher.subscribe((event) => {
      if (this.stopped) return;
      if (event.type === "tool_execution_start") {
        this.onActivity({
          kind: "tool",
          name: event.toolName,
          label: this.toolLabel(event.toolName),
          status: "running",
        });
        return;
      }
      if (event.type === "tool_execution_end") {
        this.onActivity({
          kind: "tool",
          name: event.toolName,
          label: this.toolLabel(event.toolName),
          status: event.isError ? "error" : "complete",
        });
        return;
      }
      if (
        event.type !== "message_start" &&
        event.type !== "message_update" &&
        event.type !== "message_end"
      )
        return;
      if (event.message.role !== "assistant")
        return;
      if (event.type === "message_start") {
        this.streamingTeacherMessage = false;
        this.teacherMessageId = ++this.messageSequence;
        this.onActivity({ kind: "thinking", text: "", active: true });
        return;
      }
      const message = event.message as AssistantMessage;
      const reasoning = message.content
        .filter((part) => part.type === "thinking")
        .map((part) => part.thinking)
        .join("\n\n");
      const text = message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
      if (reasoning || (event.type === "message_update" && !text)) {
        this.onActivity({
          kind: "thinking",
          text: reasoning,
          active: event.type === "message_update",
        });
      } else if (text) {
        this.onActivity(null);
      }
      if (text.trim()) {
        this.ensureNarrationPlayback(this.teacherMessageId);
        this.onMessage(
          {
            id: this.teacherMessageId,
            role: "assistant",
            text,
            streaming: event.type === "message_update",
            slideId: this.currentSlideId || undefined,
          },
          this.streamingTeacherMessage,
        );
        this.streamingTeacherMessage = event.type === "message_update";
      } else if (event.type === "message_end") {
        this.streamingTeacherMessage = false;
      }
    });
  }

  get busy() {
    return this.teacher.state.isStreaming;
  }

  async prompt(text: string) {
    if (this.stopped || this.busy) return;
    const operation = this.cancellation;
    this.onMessage({ id: ++this.messageSequence, role: "user", text });
    try {
      await this.teacher.prompt(text);
      await this.waitForNarrationPlayback();
      if (this.teacher.state.errorMessage)
        throw new Error(this.teacher.state.errorMessage);
    } catch (error) {
      if (!this.stopped && operation === this.cancellation)
        this.onError(error instanceof Error ? error.message : "暂时无法继续教学");
    }
  }

  stopCurrent() {
    this.cancellation++;
    this.teacher.abort();
    this.cancelSlides();
    this.narrationPlayback?.resolve();
    this.narrationPlayback = null;
    this.onActivity(null);
    this.modelRetries.clear();
    this.onRetry(null);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.stopCurrent();
  }

  private cancelSlides() {
    const pending = this.pendingFirst;
    this.pendingFirst = null;
    this.slideTask++;
    this.slideAgent?.abort();
    this.slideAgent = null;
    pending?.reject(new Error("课件生成已停止"));
    this.nextSlideWaiter?.reject(new Error("课件生成已停止"));
    this.nextSlideWaiter = null;
  }

  private toolLabel(name: string) {
    return (
      {
        create_slides: "准备课件",
        create_course: "建立课程",
        rename_course: "更新课程",
        show_next_slide: "切换下一页",
        read_slides: "核对课件状态",
        cancel_slides: "调整后续内容",
      }[name] ?? "使用教学工具"
    );
  }

  private updateModelRetry(
    agent: "teacher" | "slides",
    status: ModelRetryStatus | null,
  ) {
    if (status) this.modelRetries.set(agent, status);
    else this.modelRetries.delete(agent);
    const active = [...this.modelRetries.values()].sort(
      (a, b) => b.attempt - a.attempt,
    )[0];
    this.onRetry(active ?? null);
  }

  private ensureNarrationPlayback(id: number) {
    if (this.narrationPlayback?.id === id) return;
    let resolve = () => {};
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    this.narrationPlayback = { id, promise, resolve };
  }

  private waitForNarrationPlayback() {
    return this.narrationPlayback?.promise ?? Promise.resolve();
  }

  finishNarration(id: number) {
    if (this.narrationPlayback?.id !== id) return;
    this.narrationPlayback.resolve();
    this.narrationPlayback = null;
  }

  private present(slide: Slide) {
    this.currentSlideId = slide.id;
    this.onPresent(slide.id);
    return slide;
  }

  private async presentNextSlide(): Promise<Slide> {
    const operation = this.cancellation;
    await this.waitForNarrationPlayback();
    if (operation !== this.cancellation)
      throw new Error("教学播放已停止");
    const current = this.publishedSlides.findIndex(
      (slide) => slide.id === this.currentSlideId,
    );
    const next = this.publishedSlides[current + 1];
    if (next) return this.present(next);
    if (!this.slideAgent?.state.isStreaming)
      return Promise.reject(new Error("没有等待讲解的下一页"));
    return new Promise((resolve, reject) => {
      this.nextSlideWaiter = {
        afterId: this.currentSlideId,
        resolve: (slide) => resolve(this.present(slide)),
        reject,
      };
    });
  }

  private startSlides(
    info: ModelInfo,
    memory: string,
    request: SlideRequest,
  ): Promise<Slide> {
    if (request.replaceCurrent) this.cancelSlides();
    else if (this.slideAgent?.state.isStreaming)
      return Promise.reject(
        new Error(
          "A slide task is already running. Continue it or replace it explicitly.",
        ),
      );
    const task = ++this.slideTask;
    const slides: Slide[] = [];
    let settleFirst: (slide: Slide) => void = () => {};
    let rejectFirst: (error: Error) => void = () => {};
    const first = new Promise<Slide>((resolve, reject) => {
      settleFirst = resolve;
      rejectFirst = reject;
    });
    this.pendingFirst = { task, reject: rejectFirst };
    const publish: AgentTool = {
      name: "publish_slide",
      label: "发布课件页",
      description:
        "Publish exactly one completed presentation page so the student can see it immediately.",
      parameters: Type.Object({
        title: Type.String({
          maxLength: 32,
          description: "Plain-text page title.",
        }),
        kicker: Type.Optional(
          Type.String({
            maxLength: 24,
            description: "Optional plain-text section label.",
          }),
        ),
        body: Type.String({
          maxLength: 120,
          description: "Plain-text explanation without Markdown or SVG markup.",
        }),
        bullets: Type.Array(
          Type.String({
            maxLength: 48,
            description: "One concise plain-text point.",
          }),
          { maxItems: 6 },
        ),
        layout: Type.Union([
          Type.Literal("explain"),
          Type.Literal("steps"),
          Type.Literal("compare"),
        ]),
      }),
      executionMode: "sequential",
      execute: async (id, params) => {
        if (task !== this.slideTask || this.stopped)
          throw new Error("This slide task is no longer current.");
        const slide: Slide = { id, ...(params as Omit<Slide, "id">) };
        slides.push(slide);
        this.publishedSlides.push(slide);
        this.onSlides([...slides], slides.length < request.pageCount);
        if (slides.length === 1) {
          this.present(slide);
          if (this.pendingFirst?.task === task) this.pendingFirst = null;
          settleFirst(slide);
        }
        const waiter = this.nextSlideWaiter;
        if (waiter) {
          const previous = this.publishedSlides.findIndex(
            (page) => page.id === waiter.afterId,
          );
          const waitingPage = this.publishedSlides[previous + 1];
          if (waitingPage) {
            this.nextSlideWaiter = null;
            waiter.resolve(waitingPage);
          }
        }
        return {
          content: [
            { type: "text", text: `Page ${slides.length} is visible.` },
          ],
          details: { page: slides.length },
        };
      },
    };
    const agent = new Agent({
      initialState: {
        model: modelFor(info),
        messages: [],
        tools: [publish],
        systemPrompt: `You create clear K12 presentation pages for a live lesson. Publish pages one at a time with publish_slide so the first page appears quickly. Create exactly the requested number unless the task is cancelled. The client draws each page as a trusted SVG scene from the structured tool fields. Supply concise plain text only: never put Markdown, HTML, or SVG markup in title, kicker, body, or bullets. Each page must stand on its own and stay faithful to the goal. Do not emit prose outside tool calls.\nStudent memory:\n${memory || "No saved preferences yet."}`,
      },
      toolExecution: "sequential",
      streamFn: streamFor("slides", (status) =>
        this.updateModelRetry("slides", status),
      ),
    });
    this.slideAgent = agent;
    void agent
      .prompt(`Create ${request.pageCount} page(s) for this teaching goal: ${request.goal}`)
      .then(() => {
        if (task !== this.slideTask) return;
        this.slideAgent = null;
        this.onSlides([...slides], false);
        const failure = agent.state.errorMessage
          ? new Error(agent.state.errorMessage)
          : slides.length < request.pageCount
            ? new Error(
                slides.length === 0
                  ? "课件没有生成可展示的页面"
                  : `课件只生成了 ${slides.length} / ${request.pageCount} 页`,
              )
            : null;
        if (!failure) return;
        if (this.pendingFirst?.task === task) this.pendingFirst = null;
        if (slides.length === 0) rejectFirst(failure);
        this.onError(failure.message);
      })
      .catch((error) => {
        if (task !== this.slideTask || this.stopped) return;
        this.slideAgent = null;
        this.onSlides([...slides], false);
        const failure =
          error instanceof Error ? error : new Error("课件生成失败");
        if (slides.length === 0) {
          if (this.pendingFirst?.task === task) this.pendingFirst = null;
          rejectFirst(failure);
        }
        this.onError(failure.message);
      });
    return first;
  }
}
