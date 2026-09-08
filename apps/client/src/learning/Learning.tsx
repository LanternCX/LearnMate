import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { api, APIError, type User } from "../api";
import {
  answerQuestion,
  LearningSession,
  loadConversation,
  syncConversation,
  type Conversation,
  type ModelInfo,
  type Question,
} from "./session";
import "./learning.css";

export default function Learning({ user }: { user: User }) {
  const [state, setState] = useState<Conversation | null>(null);
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState("");
  const [liveText, setLiveText] = useState("");
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [correction, setCorrection] = useState("");
  const [running, setRunning] = useState(false);
  const session = useRef<LearningSession | null>(null);
  const generation = useRef(0);
  const latest = useRef<Conversation | null>(null);
  const alive = useRef(true);
  const receive = (next: Conversation) => {
    if (!alive.current) return;
    if (latest.current && next.revision < latest.current.revision) return;
    latest.current = next;
    setState(next);
  };
  const run = async (model: ModelInfo, text?: string) => {
    if (session.current || !alive.current) return;
    const epoch = generation.current;
    const current = new LearningSession(
      model,
      (next) => {
        if (generation.current === epoch) receive(next);
      },
      (value) => {
        if (alive.current && generation.current === epoch) setLiveText(value);
      },
    );
    session.current = current;
    setRunning(true);
    setError("");
    setLiveText("");
    try {
      await current.run(text);
    } catch (e) {
      if (
        alive.current &&
        generation.current === epoch &&
        !(e instanceof APIError && e.status === 409)
      )
        setError(e instanceof Error ? e.message : "暂时无法继续，请重试");
    } finally {
      if (session.current === current) session.current = null;
      if (alive.current && generation.current === epoch) setRunning(false);
    }
  };
  useEffect(() => {
    generation.current++;
    alive.current = true;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const start = async () => {
      try {
        const [initial, model] = await Promise.all([
          loadConversation(),
          api<ModelInfo>("/learning/model"),
        ]);
        if (disposed) return;
        receive(initial);
        setInfo(model);
        if (
          model.available &&
          !initial.completed &&
          initial.messages.length === 0
        )
          void run(model);
        while (!disposed) {
          const next = await syncConversation(
            latest.current?.revision ?? initial.revision,
          );
          if (disposed) return;
          receive(next);
          if (
            model.available &&
            !session.current &&
            next.status === "running" &&
            Date.parse(next.leaseUntil) < Date.now()
          )
            void run(model);
        }
      } catch (e) {
        if (disposed) return;
        setError(e instanceof Error ? e.message : "暂时无法同步，请重试");
        retry = setTimeout(() => void start(), 3000);
      }
    };
    void start();
    return () => {
      disposed = true;
      generation.current++;
      alive.current = false;
      clearTimeout(retry);
      session.current?.stop();
      session.current = null;
    };
  }, [user.id]);
  const active =
    running ||
    (state?.status === "running" && Date.parse(state.leaseUntil) > Date.now());
  return (
    <section className="learning-surface" aria-label="学习空间">
      {!state ? (
        <div className="learning-loading" role="status">
          正在找回我们的交流…
        </div>
      ) : (
        <>
          <div className="learning-topline">
            <span className="eyebrow">
              {state.completed ? "我的学习空间" : "初次见面 · 知芽"}
            </span>
            <button
              className="text-button"
              onClick={() => setMemoryOpen(!memoryOpen)}
            >
              知芽记得的我
            </button>
          </div>
          {state.completed && !state.question ? (
            <>
              <div className="learning-welcome">
                <span className="learning-sprout" aria-hidden="true">
                  ✳
                </span>
                <h1>{user.nickname}，欢迎回来。</h1>
                <p>每一次好奇，都可以是新的开始。</p>
              </div>
              <div className="learning-destinations">
                {[
                  ["01", "课程学习", "循序渐进，认识编程与 AI。"],
                  ["02", "自由探索", "从一个好问题，开始新的发现。"],
                  ["03", "AI 实验室", "动手试试，让想法变得看得见。"],
                ].map(([n, title, description]) => (
                  <article key={n}>
                    <span className="destination-number">{n}</span>
                    <h2>{title}</h2>
                    <p>{description}</p>
                    <span className="coming-soon">尚未开放</span>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <>
              {!state.question && (
                <div className="learning-welcome">
                  <span className="learning-sprout" aria-hidden="true">
                    ✳
                  </span>
                  <h1>先认识一下。</h1>
                  <p>一起找到适合你的学习方式。</p>
                </div>
              )}
              {state.question ? (
                <QuestionCard
                  key={state.question.id}
                  question={state.question}
                  submit={async (answer) => {
                    const next = await answerQuestion(
                      state.question!.id,
                      answer,
                    );
                    receive(next);
                    setLiveText("");
                    if (
                      info?.available &&
                      !session.current &&
                      Date.parse(next.leaseUntil) < Date.now()
                    )
                      void run(info);
                  }}
                />
              ) : (
                <div className="learning-progress">
                  {liveText && <p>{liveText}</p>}
                  {active ? (
                    <p role="status" className="thinking">
                      知芽正在想一想<span aria-hidden="true">…</span>
                    </p>
                  ) : (
                    <>
                      {!info?.available ? (
                        <p>知芽暂时无法开始交流，请稍后再来。</p>
                      ) : (
                        <button
                          className="primary"
                          onClick={() =>
                            void run(
                              info,
                              state.messages.at(-1)?.role === "assistant"
                                ? "请继续我们的交流。"
                                : undefined,
                            )
                          }
                        >
                          继续交流
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              <p className="memory-note">
                知芽会记住有助于学习的信息。你可以查看，也可以告诉它要修改或忘记什么。
              </p>
            </>
          )}
          {memoryOpen && (
            <section className="memory-panel" aria-label="知芽记得的我">
              <h2>慢慢认识你</h2>
              <div className="memory-document">
                <Markdown
                  allowedElements={[
                    "p",
                    "h1",
                    "h2",
                    "h3",
                    "ul",
                    "ol",
                    "li",
                    "strong",
                    "em",
                    "blockquote",
                    "code",
                    "pre",
                    "br",
                  ]}
                  unwrapDisallowed
                >
                  {state.memory || "我们还在慢慢认识彼此。"}
                </Markdown>
              </div>
              <p className="memory-note">
                这里是长期记忆。修改记忆不会删除之前的聊天记录。
              </p>
              {state.completed && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (info?.available && correction.trim()) {
                      void run(info, correction.trim());
                      setCorrection("");
                    }
                  }}
                >
                  <label htmlFor="memory-correction">
                    想补充、修改或忘记什么？
                  </label>
                  <textarea
                    id="memory-correction"
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    maxLength={4000}
                    placeholder="例如：我现在想先自己试试，再看讲解。"
                  />
                  <button
                    className="primary"
                    disabled={
                      Boolean(active) || !info?.available || !correction.trim()
                    }
                  >
                    告诉知芽
                  </button>
                  {active && <p role="status">正在处理你的修改…</p>}
                </form>
              )}
            </section>
          )}
        </>
      )}
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function QuestionCard({
  question: q,
  submit,
}: {
  question: Question;
  submit: (answer: {
    selected: string[];
    text: string;
    skipped: boolean;
  }) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus(), []);
  const send = async (skipped = false) => {
    setBusy(true);
    setError("");
    try {
      await submit({
        selected: skipped ? [] : selected,
        text: skipped ? "" : text.trim(),
        skipped,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "未能提交，请重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="question-card"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      aria-busy={busy}
    >
      <span className="question-label">一点点认识你</span>
      <h1 ref={title} tabIndex={-1} id="student-question">
        {q.text}
      </h1>
      {q.description && <p className="question-description">{q.description}</p>}
      {q.kind !== "text" && (
        <fieldset
          className="question-options"
          aria-labelledby="student-question"
          disabled={busy}
        >
          <legend className="visually-hidden">
            {q.kind === "multiple" ? "可以选择多项" : "请选择一项"}
          </legend>
          {q.options.map((option, i) => (
            <label
              className={`question-option ${selected.includes(option) ? "selected" : ""}`}
              key={option}
            >
              <input
                type={q.kind === "multiple" ? "checkbox" : "radio"}
                name="answer"
                checked={selected.includes(option)}
                onChange={(e) =>
                  setSelected(
                    q.kind === "single"
                      ? [option]
                      : e.target.checked
                        ? [...selected, option]
                        : selected.filter((v) => v !== option),
                  )
                }
              />
              <span className="option-letter" aria-hidden="true">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      )}
      <label className="answer-label" htmlFor="student-answer">
        {q.kind === "text" ? "你的回答" : "也可以用自己的话补充"}
      </label>
      <textarea
        id="student-answer"
        disabled={busy}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={4000}
        rows={q.kind === "text" ? 3 : 2}
        placeholder="简单说说就好。"
      />
      <div className="question-actions">
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => void send(true)}
        >
          还不确定
        </button>
        <button
          className="primary"
          disabled={busy || (!selected.length && !text.trim())}
        >
          {busy ? "正在提交…" : "提交回答"}
        </button>
      </div>
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
