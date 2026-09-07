import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api, APIError, setActiveUser } from "./api";
import type { User } from "./api";
import ThemeToggle from "./ThemeToggle";
import AmbientBackground from "./AmbientBackground";

type View =
  | "login"
  | "register"
  | "reset"
  | "profile"
  | "security"
  | "password"
  | "email"
  | "delete";
type Flow = { id: string; email: string };

function Field({
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

function Password({ current = false }: { current?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <Field
        label={current ? "当前密码" : "密码"}
        name={current ? "currentPassword" : "password"}
        type={visible ? "text" : "password"}
        autoComplete={current ? "current-password" : "new-password"}
        maxLength={256}
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

function Form({
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

function Mark() {
  return (
    <svg
      viewBox="0 0 40 40"
      width="36"
      height="36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 33V19M20 25C9 25 6 18 8 8c10 0 14 7 12 17ZM20 20c0-9 6-14 14-13 1 9-4 15-14 13Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Confirmation({
  text,
  answer,
}: {
  text: string;
  answer: (confirmed: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirmation"
      aria-labelledby="confirmation-title"
      onClose={() => answer(dialog.current?.returnValue === "confirm")}
    >
      <h2 id="confirmation-title">确认操作</h2>
      <p>{text}</p>
      <form method="dialog" className="inline-actions">
        <button className="secondary" value="cancel" autoFocus>
          取消
        </button>
        <button className="primary" value="confirm">
          确认
        </button>
      </form>
    </dialog>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("login");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const epoch = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const [confirmation, setConfirmation] = useState<{
    text: string;
    resolve: (value: boolean) => void;
  } | null>(null);
  function confirmAction(text: string) {
    return new Promise<boolean>((resolve) =>
      setConfirmation({ text, resolve }),
    );
  }

  async function load() {
    const generation = ++epoch.current;
    setActiveUser("");
    setUser(null);
    setAvatarDraft(null);
    setFlow(null);
    setLoading(true);
    setOffline(false);
    setError("");
    try {
      const me = await api<User>("/me");
      if (generation !== epoch.current) return;
      setActiveUser(me.id);
      setUser(me);
      setNickname(me.nickname);
      setView("profile");
    } catch (err) {
      if (generation !== epoch.current) return;
      if (err instanceof APIError && err.status === 401) {
        setUser(null);
        setView("login");
      } else {
        setOffline(true);
        setError(message(err));
      }
    } finally {
      if (generation === epoch.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      epoch.current++;
    };
  }, []);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const current = new BroadcastChannel("zhiya-account");
    channel.current = current;
    current.onmessage = () => {
      setNotice("");
      void load();
    };
    return () => {
      current.close();
      channel.current = null;
    };
  }, []);
  useEffect(() => {
    if (!loading) heading.current?.focus();
  }, [view, loading, flow]);

  function message(err: unknown) {
    return err instanceof Error ? err.message : "操作失败，请重试。";
  }
  function clearSession(text: string) {
    setActiveUser("");
    channel.current?.postMessage("changed");
    epoch.current++;
    setUser(null);
    setNickname("");
    setAvatarDraft(null);
    setFlow(null);
    setEmail("");
    setView("login");
    setNotice(text);
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    const generation = epoch.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      if (generation !== epoch.current) return;
      if (user && err instanceof APIError && err.status === 401)
        clearSession("登录已失效，请重新登录。");
      else setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const generation = epoch.current;
    const me = await api<User>("/me");
    if (generation !== epoch.current) return;
    setActiveUser(me.id);
    setUser(me);
    setNickname(me.nickname);
  }
  async function navigate(next: View) {
    if (busy) return;
    const generation = epoch.current;
    if (
      view === "profile" &&
      user &&
      (nickname !== user.nickname || avatarDraft !== null) &&
      !(await confirmAction("资料尚未保存，确定离开吗？"))
    )
      return;
    if (generation !== epoch.current) return;
    setView(next);
    setFlow(null);
    setError("");
    setNotice("");
    setAvatarDraft(null);
    if (user) setNickname(user.nickname);
  }
  async function logout(all: boolean) {
    const generation = epoch.current;
    if (
      view === "profile" &&
      user &&
      (nickname !== user.nickname || avatarDraft !== null) &&
      !(await confirmAction("资料尚未保存，确定退出吗？"))
    )
      return;
    if (
      all &&
      !(await confirmAction(
        "退出全部设备后，当前设备也需要重新登录。确定退出吗？",
      ))
    )
      return;
    if (generation !== epoch.current) return;
    await run(async () => {
      await api(all ? "/auth/logout-all" : "/auth/logout", "POST", {});
      clearSession(all ? "已退出全部设备。" : "已退出登录。");
    });
  }
  function sendCode(purpose: "register" | "reset", target: string) {
    return run(async () => {
      const result = await api<{ flow: string }>(
        `/auth/${purpose}/start`,
        "POST",
        { email: target },
      );
      setFlow({ id: result.flow, email: target });
      setNotice("若该邮箱符合条件，验证码将发送至邮箱，10 分钟内有效。");
    });
  }
  const titles: Record<View, string> = {
    login: "登录知芽",
    register: "注册账号",
    reset: "找回密码",
    profile: "个人资料",
    security: "账号安全",
    password: "修改密码",
    email: "更换邮箱",
    delete: "注销账号",
  };
  const feedback = (
    <>
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="feedback" role="status">
          {notice}
        </p>
      )}
    </>
  );

  return (
    <div className={`app ${user ? "signed-in" : "signed-out"}`}>
      {!user && <AmbientBackground />}
      <header className="brand">
        <span className="wordmark">
          <Mark />
          知芽
        </span>
        <ThemeToggle />
      </header>
      {loading || offline ? (
        <main className="connection">
          <h1 ref={heading} tabIndex={-1}>
            {loading ? "正在连接知芽" : "暂时无法连接"}
          </h1>
          {loading ? (
            <p role="status">正在检查登录状态…</p>
          ) : (
            <>
              {feedback}
              <button className="primary" onClick={() => void load()}>
                重试
              </button>
            </>
          )}
        </main>
      ) : (
        <>
          {user && (
            <aside className="sidebar">
              <p className="eyebrow">我的账号</p>
              <nav aria-label="账号设置">
                <button
                  aria-current={view === "profile" ? "page" : undefined}
                  onClick={() => navigate("profile")}
                >
                  个人资料
                </button>
                <button
                  aria-current={view !== "profile" ? "page" : undefined}
                  onClick={() => navigate("security")}
                >
                  账号安全
                </button>
              </nav>
              <button
                className="text-button sidebar-logout"
                disabled={busy}
                onClick={() => void logout(false)}
              >
                退出登录
              </button>
            </aside>
          )}
          {!user && (
            <aside className="welcome" aria-label="欢迎">
              <h2>
                从这里开始，
                <br />
                认识 AI。
              </h2>
              <p>通过课程、练习和实验学习 AI。</p>
            </aside>
          )}
          <main className="account-surface" key={view} aria-busy={busy}>
            {user && view !== "profile" && view !== "security" && (
              <button
                className="text-button back"
                disabled={busy}
                onClick={() => navigate("security")}
              >
                返回账号安全
              </button>
            )}
            <h1 ref={heading} tabIndex={-1}>
              {titles[view]}
            </h1>
            {feedback}
            <div className="view-content" key={`${view}:${user?.id ?? "guest"}:${flow?.id ?? "start"}`}>
              {!user && view === "login" && (
                <>
                  <p className="description">使用邮箱和密码，进入你的账号。</p>
                  <Form
                    busy={busy}
                    submit={(data) =>
                      run(async () => {
                        await api("/auth/login", "POST", {
                          email: data.get("email"),
                          password: data.get("password"),
                        });
                        channel.current?.postMessage("changed");
                        await load();
                      })
                    }
                  >
                    <Field
                      label="邮箱"
                      name="email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={setEmail}
                    />
                    <Field
                      label="密码"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      maxLength={256}
                    />
                    <button
                      type="button"
                      className="text-button forgot"
                      onClick={() => navigate("reset")}
                    >
                      忘记密码
                    </button>
                    <button className="primary full">
                      {busy ? "正在登录…" : "登录"}
                    </button>
                  </Form>
                </>
              )}
              {!user && (view === "register" || view === "reset") && (
                <>
                  <p className="description">
                    {flow
                      ? `验证码已申请发送至 ${flow.email}`
                      : view === "register"
                        ? "验证邮箱后，即可创建账号。"
                        : "通过注册邮箱验证身份，设置新密码。"}
                  </p>
                  {!flow ? (
                    <Form
                      busy={busy}
                      submit={(data) =>
                        sendCode(view, String(data.get("email")))
                      }
                    >
                      <Field
                        label="邮箱"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={setEmail}
                      />
                      <button className="primary full">发送验证码</button>
                    </Form>
                  ) : (
                    <Form
                      busy={busy}
                      submit={(data) =>
                        run(async () => {
                          await api(`/auth/${view}/complete`, "POST", {
                            flow: flow.id,
                            code: data.get("code"),
                            password: data.get("password"),
                          });
                          setView("login");
                          setEmail(flow.email);
                          setFlow(null);
                          setNotice(
                            view === "register"
                              ? "注册成功，请登录。"
                              : "密码已重设，请使用新密码登录。所有设备均已退出。",
                          );
                        })
                      }
                    >
                      <Field
                        label="验证码"
                        name="code"
                        autoComplete="one-time-code"
                        maxLength={8}
                      />
                      <Password />
                      <p className="hint">
                        密码至少 12 个字符。
                        {view === "reset" && "重设后所有设备都需要重新登录。"}
                      </p>
                      <button className="primary full">
                        {view === "register" ? "完成注册" : "重设密码"}
                      </button>
                      <button
                        type="button"
                        className="text-button resend"
                        onClick={() => void sendCode(view, flow.email)}
                      >
                        重新发送验证码
                      </button>
                    </Form>
                  )}
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => navigate("login")}
                  >
                    返回登录
                  </button>
                </>
              )}
              {user && view === "profile" && (
                <>
                  <p className="description">设置你在知芽使用的名字和头像。</p>
                  <section className="avatar-section" aria-label="头像设置">
                    <div className="avatar">
                      {(avatarDraft ?? user.avatar) ? (
                        <img src={avatarDraft ?? user.avatar} alt="当前头像" />
                      ) : (
                        <Mark />
                      )}
                    </div>
                    <div>
                      <p className="section-label">头像</p>
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/png,image/jpeg"
                        aria-label="上传头像"
                        className="file-input"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (
                            file.size > 2 * 1024 * 1024 ||
                            !["image/png", "image/jpeg"].includes(file.type)
                          ) {
                            setError("请选择 2 MB 以内的 PNG 或 JPEG 图片。");
                            event.target.value = "";
                            return;
                          }
                          const generation = epoch.current;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (generation === epoch.current) {
                              setAvatarDraft(String(reader.result));
                              setError("");
                            }
                          };
                          reader.onerror = () =>
                            setError("无法读取图片，请重新选择。");
                          reader.readAsDataURL(file);
                          event.target.value = "";
                        }}
                      />
                      <div className="inline-actions">
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => fileInput.current?.click()}
                        >
                          上传头像
                        </button>
                        {(user.avatar || avatarDraft) && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => setAvatarDraft("")}
                          >
                            恢复默认头像
                          </button>
                        )}
                      </div>
                      <p className="hint">
                        PNG 或 JPEG，最大 2 MB，边长不超过 2048 像素。
                      </p>
                      {avatarDraft !== null && (
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api("/me/avatar", "PUT", {
                                avatar: avatarDraft,
                              });
                              await refresh();
                              setAvatarDraft(null);
                              setNotice("头像已保存。");
                            })
                          }
                        >
                          保存头像
                        </button>
                      )}
                    </div>
                  </section>
                  <Form
                    busy={busy}
                    submit={() =>
                      run(async () => {
                        await api("/me", "PATCH", { nickname });
                        await refresh();
                        setNotice("昵称已保存。");
                      })
                    }
                  >
                    <Field
                      label="昵称"
                      name="nickname"
                      autoComplete="nickname"
                      maxLength={40}
                      value={nickname}
                      onChange={setNickname}
                    />
                    <button className="primary">保存昵称</button>
                  </Form>
                  <div className="email-summary">
                    <span>登录邮箱</span>
                    <strong>{user.email}</strong>
                    <span className="verified">已验证</span>
                  </div>
                </>
              )}
              {user && view === "security" && (
                <>
                  <p className="description">管理登录方式与账号安全。</p>
                  <div className="settings-list">
                    <div>
                      <div>
                        <h2>登录邮箱</h2>
                        <p>{user.email}</p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => navigate("email")}
                      >
                        更换邮箱
                      </button>
                    </div>
                    <div>
                      <div>
                        <h2>密码</h2>
                        <p>修改后，所有设备需要重新登录。</p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => navigate("password")}
                      >
                        修改密码
                      </button>
                    </div>
                    <div>
                      <div>
                        <h2>登录状态</h2>
                        <p>退出所有设备，包括当前设备。</p>
                      </div>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => void logout(true)}
                      >
                        退出全部设备
                      </button>
                    </div>
                    <div className="danger-row">
                      <div>
                        <h2>注销账号</h2>
                        <p>永久删除账号及关联个人数据，无法恢复。</p>
                      </div>
                      <button
                        className="text-button danger-text"
                        onClick={() => navigate("delete")}
                      >
                        注销账号
                      </button>
                    </div>
                  </div>
                </>
              )}
              {user && view === "password" && (
                <>
                  <p className="description">
                    修改后，当前及其他设备都需要重新登录。
                  </p>
                  <Form
                    busy={busy}
                    submit={(data) =>
                      run(async () => {
                        await api("/me/password", "PUT", {
                          currentPassword: data.get("currentPassword"),
                          password: data.get("password"),
                        });
                        clearSession("密码已修改，请使用新密码登录。");
                      })
                    }
                  >
                    <Password current />
                    <Password />
                    <p className="hint">新密码至少 12 个字符。</p>
                    <button className="primary">保存新密码</button>
                  </Form>
                </>
              )}
              {user && view === "email" && (
                <>
                  <p className="description">
                    更换邮箱需要验证原邮箱和新邮箱，资料与学习记录会保留。
                  </p>
                  {!flow ? (
                    <Form
                      busy={busy}
                      submit={(data) =>
                        run(async () => {
                          const target = String(data.get("email"));
                          const result = await api<{ flow: string }>(
                            "/me/email/start",
                            "POST",
                            { email: target },
                          );
                          setFlow({ id: result.flow, email: target });
                          setNotice("验证码已分别发送至原邮箱和新邮箱。");
                        })
                      }
                    >
                      <p className="hint">原邮箱：{user.email}</p>
                      <Field
                        label="新邮箱"
                        name="email"
                        type="email"
                        autoComplete="email"
                      />
                      <button className="primary">发送两封验证邮件</button>
                    </Form>
                  ) : (
                    <Form
                      busy={busy}
                      submit={(data) =>
                        run(async () => {
                          await api("/me/email/complete", "POST", {
                            flow: flow.id,
                            code: data.get("code"),
                            newCode: data.get("newCode"),
                          });
                          await refresh();
                          setFlow(null);
                          setView("security");
                          setNotice("邮箱已更换，请使用新邮箱登录。");
                        })
                      }
                    >
                      <p className="hint">
                        原邮箱：{user.email}
                        <br />
                        新邮箱：{flow.email}
                      </p>
                      <Field
                        label="原邮箱验证码"
                        name="code"
                        autoComplete="one-time-code"
                        maxLength={8}
                      />
                      <Field
                        label="新邮箱验证码"
                        name="newCode"
                        autoComplete="off"
                        maxLength={8}
                      />
                      <button className="primary">确认更换邮箱</button>
                      <button
                        type="button"
                        className="text-button resend"
                        onClick={() => {
                          setFlow(null);
                          setNotice("");
                        }}
                      >
                        重新获取验证码
                      </button>
                    </Form>
                  )}
                  <p className="hint">
                    无法访问原邮箱时，暂不支持人工申诉更换。
                  </p>
                </>
              )}
              {user && view === "delete" && (
                <>
                  <div className="deletion-warning">
                    <h2>注销后无法恢复</h2>
                    <p>
                      账号、昵称、头像及关联个人数据（包括学习记录）将被永久删除。所有设备会立即退出登录。
                    </p>
                  </div>
                  <Form
                    busy={busy}
                    submit={(data) =>
                      run(async () => {
                        await api("/me", "DELETE", {
                          currentPassword: data.get("currentPassword"),
                          confirm: data.get("confirm") === "on",
                        });
                        clearSession("账号已注销，关联个人数据已删除。");
                      })
                    }
                  >
                    <Password current />
                    <label className="checkbox">
                      <input type="checkbox" name="confirm" required />
                      我确认永久删除账号及关联个人数据，且无法恢复
                    </label>
                    <button className="primary danger">永久注销账号</button>
                  </Form>
                </>
              )}
            </div>
            {busy && (
              <p className="hint" role="status">
                正在处理，请稍候…
              </p>
            )}
          </main>
          {!user && view === "login" && (
            <div className="switch-auth glass">
              <span>还没有账号？</span>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => navigate("register")}
              >
                注册账号
              </button>
            </div>
          )}
        </>
      )}
      {confirmation && (
        <Confirmation
          text={confirmation.text}
          answer={(confirmed) => {
            confirmation.resolve(confirmed);
            setConfirmation(null);
          }}
        />
      )}
      <footer>知芽 · Zhiya</footer>
    </div>
  );
}
