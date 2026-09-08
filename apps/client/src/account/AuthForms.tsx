import { usePolicy } from "./Policy";
import { api } from "../api";
import { Field, Form, Password } from "./Form";
import type { AccountController } from "./useAccount";

type Props = Pick<
  AccountController,
  | "view"
  | "flow"
  | "busy"
  | "email"
  | "setEmail"
  | "navigate"
  | "sendCode"
  | "run"
  | "setView"
  | "setFlow"
  | "setNotice"
  | "login"
>;

export default function AuthForms({
  view,
  flow,
  busy,
  email,
  setEmail,
  navigate,
  sendCode,
  run,
  setView,
  setFlow,
  setNotice,
  login,
}: Props) {
  const rules = usePolicy();
  return (
    <>
      {view === "login" && (
        <>
          <p className="description">使用邮箱和密码，进入你的账号。</p>
          <Form busy={busy} submit={login}>
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
              maxLength={rules.password_max_bytes}
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
      {(view === "register" || view === "reset") && (
        <>
          <p className="description">
            {flow
              ? `请填写 ${flow.email} 收到的验证码`
              : view === "register"
                ? "验证邮箱后，即可创建账号。"
                : "通过注册邮箱验证身份，设置新密码。"}
          </p>
          {!flow ? (
            <Form
              busy={busy}
              submit={(data) => sendCode(view, String(data.get("email")))}
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
                      ? "注册成功，请登录"
                      : "密码已重设，所有设备均已退出，请使用新密码登录",
                  );
                })
              }
            >
              <Field
                label="验证码"
                name="code"
                autoComplete="one-time-code"
                maxLength={rules.verification_code_digits}
              />
              <Password />
              <p className="hint">
                密码至少 {rules.password_min_characters} 个字符
                {view === "reset" && "，重设后所有设备都需要重新登录"}
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
    </>
  );
}
