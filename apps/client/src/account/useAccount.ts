import { useEffect, useRef, useState } from "react";
import { api, APIError, setActiveUser } from "../api";
import type { User } from "../api";
import type { Flow, View } from "./types";

export function useAccount() {
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
    setBusy(false);
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

  function message(err: unknown) {
    return err instanceof Error ? err.message : "操作失败，请重试。";
  }
  function clearSession(text: string) {
    setActiveUser("");
    channel.current?.postMessage("changed");
    epoch.current++;
    setBusy(false);
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
      if (generation === epoch.current) setBusy(false);
    }
  }
  async function refresh() {
    const generation = epoch.current;
    const me = await api<User>("/me");
    if (generation !== epoch.current)
      throw new APIError(409, "账号已切换，请重新操作。");
    setActiveUser(me.id);
    setUser(me);
    return me;
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
  async function login(data: FormData) {
    await run(async () => {
      await api("/auth/login", "POST", {
        email: data.get("email"),
        password: data.get("password"),
      });
      channel.current?.postMessage("changed");
      await load();
    });
  }

  return {
    user,
    view,
    loading,
    offline,
    busy,
    error,
    notice,
    flow,
    email,
    nickname,
    avatarDraft,
    confirmation,
    load,
    login,
    navigate,
    logout,
    sendCode,
    run,
    refresh,
    clearSession,
    setView,
    setFlow,
    setEmail,
    setNickname,
    setAvatarDraft,
    setError,
    setNotice,
    answerConfirmation(confirmed: boolean) {
      confirmation?.resolve(confirmed);
      setConfirmation(null);
    },
  };
}

export type AccountController = ReturnType<typeof useAccount>;
