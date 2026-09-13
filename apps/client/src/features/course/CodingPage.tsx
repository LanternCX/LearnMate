import { useState } from "react";
import { MessageResponse } from "../../components/ai-elements/message";
import { Spinner } from "../../components/ui/spinner";
import type { CodingExercise } from "../../domain/learning";
import CodeEditor from "./CodeEditor";

function exerciseFilename(languageName: string) {
  const language = languageName.toLowerCase();
  if (language.includes("typescript")) return "main.ts";
  if (language.includes("javascript")) return "main.js";
  if (language.includes("python")) return "main.py";
  if (language.includes("c++")) return "main.cpp";
  if (/^c(?:\s|\(|$)/.test(language)) return "main.c";
  if (language.includes("java")) return "Main.java";
  if (/^go(?:\s|\(|$)/.test(language)) return "main.go";
  if (language.includes("rust")) return "main.rs";
  return "main.txt";
}

export default function CodingPage({
  exercise,
  onChange,
  onRun,
  onEnd,
}: {
  exercise: CodingExercise;
  onChange: (changes: Pick<CodingExercise, "code" | "stdin">) => void;
  onRun: () => Promise<void>;
  onEnd: () => Promise<void>;
}) {
  const [running, setRunning] = useState(false);
  const ended = exercise.status === "ended";
  const result = exercise.result;
  const output = result
    ? [result.compileOutput, result.stdout, result.stderr, result.message]
        .filter(Boolean)
        .join("\n")
    : "";
  return (
    <article className="coding-page" aria-label={`编程练习：${exercise.title}`}>
      <header>
        <div>
          <p>编程练习</p>
          <h2>{exercise.title}</h2>
        </div>
        <span data-status={exercise.status}>{ended ? "已结束" : "练习中"}</span>
      </header>
      <section className="coding-instructions" aria-label="题目说明">
        <MessageResponse>{exercise.instructions}</MessageResponse>
      </section>
      <section className="coding-editor-shell" aria-label="代码编辑区">
        <header className="coding-editor-bar">
          <span>{exerciseFilename(exercise.languageName)}</span>
          <span>{exercise.languageName}</span>
        </header>
        <CodeEditor
          value={exercise.code}
          languageName={exercise.languageName}
          readOnly={ended}
          onChange={(code) => onChange({ code, stdin: exercise.stdin })}
        />
      </section>
      <label>
        <span>标准输入（可选）</span>
        <textarea
          aria-label="标准输入"
          className="coding-stdin"
          value={exercise.stdin}
          disabled={ended}
          onChange={(event) =>
            onChange({ code: exercise.code, stdin: event.target.value })
          }
        />
      </label>
      {result && (
        <section className="coding-output" aria-label="运行结果">
          <header>
            <span>输出</span>
            <span>{result.status.description}</span>
          </header>
          <pre>{output || "程序没有产生输出"}</pre>
        </section>
      )}
      <footer className="coding-actions">
        <button
          aria-busy={running}
          aria-label={running ? "代码正在运行" : undefined}
          className="coding-run-button"
          disabled={ended || running}
          onClick={() => {
            setRunning(true);
            void onRun().finally(() => setRunning(false));
          }}
        >
          {running ? <Spinner aria-hidden="true" /> : "运行代码"}
        </button>
        <button disabled={ended || running} onClick={() => void onEnd()}>
          {ended ? "练习已结束" : "结束练习"}
        </button>
      </footer>
    </article>
  );
}
