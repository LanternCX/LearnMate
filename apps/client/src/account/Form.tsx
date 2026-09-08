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
        className="text-button password-toggle"
        type="button"
        aria-pressed={visible}
        aria-label={visible ? "隐藏密码" : "显示密码"}
        onClick={() => setVisible(!visible)}
      >
        {visible ? "隐藏" : "显示"}
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
