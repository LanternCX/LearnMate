import { usePolicy } from "./Policy";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  maxLength,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={value}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
        required
        spellCheck={false}
      />
    </label>
  );
}

export function Password({ current = false }: { current?: boolean }) {
  const rules = usePolicy();
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <Field
        label={current ? "当前密码" : "密码"}
        name={current ? "currentPassword" : "password"}
        type={visible ? "text" : "password"}
        autoComplete={current ? "current-password" : "new-password"}
        maxLength={rules.password_max_bytes}
      />
      <button
        className="password-toggle"
        type="button"
        aria-pressed={visible}
        aria-label={visible ? "隐藏密码" : "显示密码"}
        title={visible ? "隐藏密码" : "显示密码"}
        onClick={() => setVisible(!visible)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {visible ? (
            <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.5 5.3A10.5 10.5 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3.1 3.8M6.2 6.2A20 20 0 0 0 2 12s4 7 10 7a11 11 0 0 0 5.8-1.8" />
          ) : (
            <>
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}

export function Form({
  children,
  submit,
  busy,
}: {
  children: ReactNode;
  submit: (data: FormData) => Promise<void>;
  busy: boolean;
}) {
  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!busy) void submit(new FormData(event.currentTarget));
      }}
    >
      <fieldset disabled={busy}>{children}</fieldset>
    </form>
  );
}
