import type { Agent } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
  ModelInfo,
  ModelRetryListener,
  ModelRetryStatus,
  Slide,
  CourseMessage,
  CourseActivity,
  CourseConversationState,
} from "../../domain/learning";
import type { ModelGateway } from "../gateway";
import { createTeacherAgent, teacherToolLabel } from "../agent/teacher";
import { createSlidesAgent } from "../agent/slides";
import type { CourseManagement } from "../tool";
import type { SlideRequest } from "../tools/create_slides";

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
  private modelRetries = new Map<"teacher" | "slides", ModelRetryStatus>();

  constructor(
    private gateway: ModelGateway,
    info: ModelInfo,
    memory: string,
    private onMessage: (message: CourseMessage, replaceLast?: boolean) => void,
    private onSlides: (slides: Slide[], generating: boolean) => void,
    private onPresent: (slideId: string) => void,
    private onActivity: (activity: CourseActivity | null) => void,
    private onRetry: ModelRetryListener,
    private onError: (message: string) => void,
    initial: CourseConversationState,
    courseManagement: CourseManagement,
  ) {
    this.publishedSlides = [...initial.slides];
    this.currentSlideId = initial.currentSlideId;
    this.messageSequence = initial.messages.reduce(
      (largest, message) => Math.max(largest, message.id),
      0,
    );
    this.teacher = createTeacherAgent({
      model: info,
      gateway: this.gateway,
      memory,
      messages: initial.messages,
      management: courseManagement,
      slides: {
        start: (request) => this.startSlides(info, memory, request),
        cancel: () => this.cancelSlides(),
        read: () => ({
          pages: this.publishedSlides,
          generating: Boolean(this.slideAgent?.state.isStreaming),
        }),
        next: () => this.presentNextSlide(),
      },
      onRetry: (status) => this.updateModelRetry("teacher", status),
    });
    this.teacher.subscribe((event) => {
      if (this.stopped) return;
      if (event.type === "tool_execution_start") {
        this.onActivity({
          kind: "tool",
          name: event.toolName,
          label: teacherToolLabel(event.toolName),
          status: "running",
        });
        return;
      }
      if (event.type === "tool_execution_end") {
        this.onActivity({
          kind: "tool",
          name: event.toolName,
          label: teacherToolLabel(event.toolName),
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
    const agent = createSlidesAgent({
      model: info,
      gateway: this.gateway,
      memory,
      onRetry: (status) => this.updateModelRetry("slides", status),
      publish: (id, page) => {
        if (task !== this.slideTask || this.stopped)
          throw new Error("This slide task is no longer current.");
        const slide: Slide = { id, ...page };
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

        return slides.length;
      },
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
