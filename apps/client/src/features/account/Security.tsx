import { api } from "../../api";
import { useId, useState } from "react";
import type { User } from "../../api";
import { CodeField, Field, Form, NewPasswordFields, Password } from "./Form";
import type { AccountController } from "./useAccount";
import { useVerification, VerificationActions, VerificationHelp } from "./Verification";

type Props = Pick<
  AccountController,
  | "view"
  | "flow"
  | "busy"
  | "navigate"
  | "logout"
  | "run"
  | "runConfirmed"
  | "sendEmailCode"
  | "clearSession"
  | "setFlow"
  | "setNotice"
  | "refresh"
  | "setView"
> & { user: User };

export default function Security({
  user,
  view,
  flow,
  busy,
  navigate,
  logout,
  run,
  runConfirmed,
  sendEmailCode,
  clearSession,
  setFlow,
  setNotice,
  refresh,
  setView,
}: Props) {
  const verification = useVerification(flow);
  return (
    <>
      {view === "security" && (
        <>
          <div className="settings-list">
            <div>
              <div>
                <h2>登录邮箱</h2>
                <p>{user.email}</p>
              </div>
              <button className="secondary" onClick={() => navigate("email")}>
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
      {view === "password" && (
        <>
          <p className="description">修改后，当前及其他设备都需要重新登录。</p>
          <Form
            busy={busy}
            submit={(data) =>
              run(async () => {
                await api("/me/password", "PUT", {
                  currentPassword: data.get("currentPassword"),
                  password: data.get("password"),
                });
                clearSession("密码已修改，请使用新密码登录");
              })
            }
          >
            <Password current />
            <NewPasswordFields />
            <button className="primary">保存新密码</button>
          </Form>
        </>
      )}
      {view === "email" && (
        <>
          <p className="description">
            更换邮箱需要验证原邮箱和新邮箱，资料与学习记录会保留。
          </p>
          {!flow ? (
            <Form
              busy={busy}
              submit={(data) => sendEmailCode(String(data.get("email")))}
            >
              <p className="hint">原邮箱：{user.email}</p>
              <Field
                label="新邮箱"
                name="email"
                type="email"
                autoComplete="email"
                validate={text => text.toLowerCase() === user.email.toLowerCase() ? "请输入不同的新邮箱" : ""}
              />
              <button className="primary">{busy ? "正在发送…" : "发送两封验证邮件"}</button>
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
                  setNotice("邮箱已更换，请使用新邮箱登录");
                })
              }
            >
              <p className="hint">
                原邮箱：{user.email}
                <br />
                新邮箱：{flow.email}
              </p>
              <CodeField key={`${flow.id}:old`} label="原邮箱验证码" />
              <CodeField key={`${flow.id}:new`} label="新邮箱验证码" name="newCode" />
              <VerificationHelp {...verification} />
              <button className="primary" disabled={verification.expired}>确认更换邮箱</button>
              <VerificationActions cooldown={verification.cooldown} busy={busy}
                resend={() => sendEmailCode(flow.email)} changeEmail={() => void navigate("email")} />
            </Form>
          )}
          <p className="hint">无法访问原邮箱时，暂不支持人工申诉更换</p>
        </>
      )}
      {view === "delete" && (
        <>
          <Form
            busy={busy}
            submit={(data) =>
              runConfirmed({
                title: "永久注销账号？",
                text: "账号及关联个人数据（包括学习记录）将被永久删除，无法恢复。所有设备都会退出登录。",
                confirmLabel: "永久注销账号",
                danger: true,
              }, async () => {
                await api("/me", "DELETE", {
                  currentPassword: data.get("currentPassword"),
                  confirm: data.get("confirm") === "on",
                });
                clearSession("账号已注销，关联个人数据已删除");
              })
            }
          >
            <Password current />
            <DeletionConsent />
            <button className="primary danger">永久注销账号</button>
          </Form>
        </>
      )}
    </>
  );
}

function DeletionConsent() {
  const id = useId();
  const [checked, setChecked] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const invalid = attempted && !checked;
  return <div className="deletion-consent">
    <label className="checkbox">
      <input type="checkbox" name="confirm" required checked={checked}
        onChange={event => setChecked(event.target.checked)}
        onInvalid={event => { event.preventDefault(); setAttempted(true); }}
        aria-invalid={invalid ? true : undefined} aria-describedby={invalid ? id : undefined} />
      我确认永久删除账号及关联个人数据，且无法恢复
    </label>
    <p id={id} className="field-error" aria-live="polite" hidden={!invalid}>请先确认注销后无法恢复</p>
  </div>;
}
