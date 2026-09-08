import { useEffect, useRef } from "react";
import ThemeToggle from "./components/ThemeToggle";
import AmbientBackground from "./components/AmbientBackground";
import Mark from "./components/Mark";
import Confirmation from "./components/Confirmation";
import AuthForms from "./account/AuthForms";
import Profile from "./account/Profile";
import Security from "./account/Security";
import { useAccount } from "./account/useAccount";
import type { View } from "./account/types";
import { PolicyContext } from "./account/Policy";

export default function App() {
  const account = useAccount();
  const {
    user,
    view,
    loading,
    offline,
    busy,
    error,
    notice,
    flow,
    confirmation,
    load,
    navigate,
    logout,
    answerConfirmation,
  } = account;
  const heading = useRef<HTMLHeadingElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const hasFlow = flow !== null;
  useEffect(() => {
    if (!loading) heading.current?.focus();
  }, [view, loading, hasFlow]);
  useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);

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
        <p ref={errorMessage} tabIndex={-1} className="feedback error" role="alert">
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
    <PolicyContext.Provider value={account.policy}>
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
              <div
                className="view-content"
                key={`${view}:${user?.id ?? "guest"}:${flow?.email ?? "start"}`}
              >
                {!user ? (
                  <AuthForms {...account} />
                ) : view === "profile" ? (
                  <Profile {...account} user={user} />
                ) : (
                  <Security {...account} user={user} />
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
          <Confirmation {...confirmation} answer={answerConfirmation} />
        )}
        <footer>知芽 · Zhiya</footer>
      </div>
    </PolicyContext.Provider>
  );
}
