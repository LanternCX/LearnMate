import { useEffect, useRef, useState } from "react";
import "./course.css";
import type { CourseSession } from "../../pi";
import { createCourseSession } from "./runtime";
import type {
  CourseActivity,
  CourseMessage,
  Slide,
  ModelInfo,
  ModelRetryStatus,
  CourseConversationState,
  StoredCourse,
} from "../../domain/learning";
import { MessageResponse } from "../../components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "../../components/ai-elements/reasoning";
import { Shimmer } from "../../components/ai-elements/shimmer";
import { PromptInputSubmit } from "../../components/ai-elements/prompt-input";
import { Spinner } from "../../components/ui/spinner";
import SlideCanvas from "./SlideCanvas";
import CourseLibrary from "./CourseLibrary";
import Icon from "../../components/Icon";
import ConnectionRetry from "../../components/ConnectionRetry";
import {
  createCourse,
  emptyCourseState,
  saveCourseConversation,
  updateCourse,
} from "./courses";

type RenderedCourseMessage = CourseMessage;

const conversationControls = {
  code: { copy: true, download: false },
  image: false,
  mermaid: {
    copy: true,
    download: false,
    fullscreen: false,
    panZoom: false,
  },
  table: { copy: true, download: false, fullscreen: false },
} as const;

function Activity({ activity }: { activity: CourseActivity | null }) {
  if (!activity) return null;
  if (activity.kind === "thinking")
    return (
      <Reasoning
        className="course-activity course-thinking"
        isStreaming={activity.active}
      >
        <ReasoningTrigger
          className="course-thinking-trigger"
          getThinkingMessage={(streaming, seconds) =>
            streaming ? (
              <Shimmer className="course-thinking-shimmer" duration={1}>
                正在思考教学节奏…
              </Shimmer>
            ) : (
              <span>{seconds ? `已思考 ${seconds} 秒` : "已完成思考"}</span>
            )
          }
        />
        {activity.text && (
          <ReasoningContent>{activity.text}</ReasoningContent>
        )}
      </Reasoning>
    );
  return (
    <div
      className="course-activity course-tool-activity"
      data-status={activity.status}
      role="status"
    >
      {activity.status === "running" && <Spinner />}
      <span className="course-tool-mark" aria-hidden="true" />
      {activity.status === "running" ? (
        <Shimmer duration={1}>{`正在${activity.label}`}</Shimmer>
      ) : (
        <span>
          {activity.status === "error"
            ? `${activity.label}失败`
            : `${activity.label}完成`}
        </span>
      )}
    </div>
  );
}

export default function CourseRoom({
  info,
  memory,
  courses,
  activeCourse,
  coursesReady,
  roomToken,
  libraryError,
  onOpenCourse,
  onRenameCourse,
  onDeleteCourse,
  onCourseCreated,
  onCourseUpdated,
}: {
  info: ModelInfo | null;
  memory: string;
  courses: StoredCourse[];
  activeCourse: StoredCourse | null;
  coursesReady: boolean;
  roomToken: number;
  libraryError: string;
  onOpenCourse: (course: StoredCourse) => void;
  onRenameCourse: (course: StoredCourse, title: string) => Promise<boolean>;
  onDeleteCourse: (course: StoredCourse) => Promise<boolean>;
  onCourseCreated: (course: StoredCourse) => void;
  onCourseUpdated: (course: StoredCourse) => void;
}) {
  const [messages, setMessages] = useState<RenderedCourseMessage[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [presented, setPresented] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<CourseActivity | null>(null);
  const [modelRetry, setModelRetry] = useState<ModelRetryStatus | null>(null);
  const [course, setCourse] = useState<StoredCourse | null>(activeCourse);
  const session = useRef<CourseSession | null>(null);
  const sessionCourse = useRef<StoredCourse | null>(activeCourse);
  const pendingSave = useRef<{
    course: StoredCourse;
    state: CourseConversationState;
  } | null>(null);
  const latestSnapshot = useRef<{
    course: StoredCourse;
    state: CourseConversationState;
  } | null>(null);
  const saveInFlight = useRef(false);
  const thread = useRef<HTMLDivElement | null>(null);
  const flushCourseSave = async () => {
    if (saveInFlight.current || !pendingSave.current) return;
    const next = pendingSave.current;
    pendingSave.current = null;
    saveInFlight.current = true;
    try {
      await saveCourseConversation(next.course, next.state);
    } catch {
      setError("课程进度暂时无法保存");
    } finally {
      saveInFlight.current = false;
      if (pendingSave.current) void flushCourseSave();
    }
  };

  useEffect(() => {
    if (!info?.available || !coursesReady) return;
    const initial = activeCourse?.state ?? emptyCourseState();
    sessionCourse.current = activeCourse;
    setCourse(activeCourse);
    setMessages(initial.messages);
    setSlides(initial.slides);
    setPresented(new Set(initial.presentedSlideIds));
    const initialPage = initial.slides.findIndex(
      (slide) => slide.id === initial.currentSlideId,
    );
    setPage(Math.max(0, initialPage));
    setBusy(false);
    setActivity(null);
    setModelRetry(null);
    setError("");
    const current = createCourseSession(
      info,
      memory,
      (message, replaceLast) =>
        setMessages((all) => {
          if (!replaceLast) return [...all, message];
          return [...all.slice(0, -1), message];
        }),
      (next) => {
        setSlides((existing) => {
          const added = next.filter(
            (slide) => !existing.some((item) => item.id === slide.id),
          );
          return [...existing, ...added];
        });
      },
      (slideId) => {
        setPresented((existing) => new Set(existing).add(slideId));
        setSlides((existing) => {
          const index = existing.findIndex((slide) => slide.id === slideId);
          if (index >= 0) setPage(index);
          return existing;
        });
      },
      setActivity,
      setModelRetry,
      setError,
      initial,
      {
        course: activeCourse,
        create: async (title, topic, cover) => {
          const created = await createCourse(title, topic, cover);
          sessionCourse.current = created;
          setCourse(created);
          onCourseCreated(created);
          return created;
        },
        rename: async (title, topic) => {
          if (!sessionCourse.current)
            throw new Error("课程尚未建立");
          const updated = await updateCourse(sessionCourse.current.id, {
            title,
            ...(topic ? { topic } : {}),
          });
          const next = { ...updated, state: sessionCourse.current.state };
          sessionCourse.current = next;
          setCourse(next);
          onCourseUpdated(next);
          return next;
        },
      },
    );
    session.current = current;
    return () => {
      current.stop();
      if (session.current === current) session.current = null;
    };
  }, [info?.available, info?.id, memory, roomToken, coursesReady]);

  useEffect(() => {
    if (!course) return;
    const state = {
      messages,
      slides,
      presentedSlideIds: [...presented],
      currentSlideId: slides[page]?.id ?? "",
    };
    const updated = { ...course, state };
    sessionCourse.current = updated;
    latestSnapshot.current = { course, state };
    onCourseUpdated(updated);
    const timer = window.setTimeout(() => {
      pendingSave.current = { course, state };
      void flushCourseSave();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [course?.id, course?.conversationId, messages, slides, presented, page]);

  useEffect(
    () => () => {
      const latest = latestSnapshot.current;
      if (!latest || latest.course.id !== course?.id) return;
      pendingSave.current = latest;
      void flushCourseSave();
    },
    [course?.id],
  );

  useEffect(() => {
    let latest: RenderedCourseMessage | undefined;
    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index].role === "assistant") {
        latest = messages[index];
        break;
      }
    }
    if (!latest || latest.streaming) return;
    session.current?.finishNarration(latest.id);
  }, [messages]);

  useEffect(() => {
    const element = thread.current;
    if (!element) return;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [messages, activity]);

  const runPrompt = async (value: string) => {
    if (!value || busy || !session.current) return;
    setError("");
    setActivity({ kind: "thinking", text: "", active: true });
    setBusy(true);
    await session.current.prompt(value);
    setBusy(false);
  };
  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    await runPrompt(value);
  };
  const interrupt = () => {
    session.current?.stopCurrent();
    setActivity(null);
    setBusy(false);
  };
  const running = busy;
  const current = slides[Math.min(page, Math.max(0, slides.length - 1))];

  useEffect(() => {
    const container = thread.current;
    if (!container || !current) return;
    const frame = window.requestAnimationFrame(() => {
      const anchor = [...container.querySelectorAll<HTMLElement>(".course-message")]
        .find((message) => message.dataset.slideId === current.id);
      if (!anchor) return;
      const top =
        container.scrollTop +
        anchor.getBoundingClientRect().top -
        container.getBoundingClientRect().top;
      container.scrollTo({
        top,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [current?.id]);

  const previousPage = page - 1;
  const nextPage = page + 1;
  const canGoPrevious =
    !busy &&
    previousPage >= 0 &&
    presented.has(slides[previousPage]?.id ?? "");
  const canGoNext =
    !busy &&
    nextPage < slides.length &&
    presented.has(slides[nextPage]?.id ?? "");

  return (
    <section
      className="course-room ai-elements"
      aria-label="课堂"
      data-has-slides={Boolean(current)}
    >
      <section className="course-conversation" aria-label="教学对话">
        <div className="course-thread" aria-live="polite" ref={thread}>
          {messages.length === 0 ? (
            <div className="course-start">
              <div className="subject-art learning">
                <Icon name="learning" />
              </div>
              <h1>今天想学什么？</h1>
              <CourseLibrary
                courses={courses}
                error={libraryError}
                onOpen={onOpenCourse}
                onRename={onRenameCourse}
                onDelete={onDeleteCourse}
              />
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={`course-message ${message.role}`}
                aria-current={
                  message.slideId && message.slideId === current?.id
                    ? "step"
                    : undefined
                }
                data-slide-id={message.slideId}
              >
                <span>{message.role === "user" ? "我" : "知芽"}</span>
                {message.role === "assistant" ? (
                  <MessageResponse
                    className="course-message-body"
                    controls={conversationControls}
                    isAnimating={message.streaming}
                  >
                    {message.text}
                  </MessageResponse>
                ) : (
                  <p>{message.text}</p>
                )}
              </article>
            ))
          )}
          <Activity activity={activity} />
          <ConnectionRetry status={modelRetry} />
        </div>
        {error && <p className="feedback error" role="alert">{error}</p>}
        <form className="course-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <label className="sr-only" htmlFor="course-prompt">告诉知芽你想学什么</label>
          <textarea
            id="course-prompt"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="告诉知芽你想学什么…"
            disabled={!info?.available || !coursesReady}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <PromptInputSubmit
            aria-label={running ? "打断" : "发送"}
            className="course-submit"
            disabled={
              !running && (!text.trim() || !info?.available || !coursesReady)
            }
            onStop={interrupt}
            status={running ? "streaming" : "ready"}
            title={running ? "打断" : "发送"}
          />
        </form>
      </section>

      {current && (
        <section className="slide-stage" aria-label="分页课件">
          <SlideCanvas key={current.id} slide={current} />
          <footer className="slide-controls">
            <button aria-label="上一页" title="上一页" disabled={!canGoPrevious} onClick={() => setPage(previousPage)}>←</button>
            <span>{`${page + 1} / ${presented.size}`}</span>
            <button aria-label="下一页" title="下一页" disabled={!canGoNext} onClick={() => setPage(nextPage)}>→</button>
          </footer>
        </section>
      )}
    </section>
  );
}
