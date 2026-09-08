import { useEffect, useState } from "react";
import { usePolicy } from "./Policy";
import type { Flow } from "./types";

// A short resend delay prevents accidental repeated mail requests. The server
// remains authoritative for rate limits and verification expiry.
const resendDelaySeconds = 30;

export function useVerification(flow: Flow | null) {
  const rules = usePolicy();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!flow) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [flow]);
  const elapsed = flow ? Math.max(0, Math.floor((now - flow.sentAt) / 1000)) : 0;
  const remaining = Math.max(0, rules.verification_ttl_seconds - elapsed);
  return {
    expired: !!flow && remaining === 0,
    remaining,
    cooldown: flow ? Math.max(0, resendDelaySeconds - elapsed) : 0,
  };
}

export function VerificationHelp({ expired, remaining }: Pick<ReturnType<typeof useVerification>, "expired" | "remaining">) {
  return <div className="verification-help">
    <p className="field-error" aria-live="polite" hidden={!expired}>{expired ? "验证码已过期，请重新发送" : ""}</p>
    {!expired && <p className="field-hint" role="timer" aria-live="off">
      验证码有效期剩余 {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
    </p>}
    <p className="field-hint">未收到邮件？请检查垃圾邮件，或稍后重新发送。</p>
  </div>;
}

export function VerificationActions({ cooldown, busy, resend, changeEmail }: {
  cooldown: number;
  busy: boolean;
  resend: () => Promise<void>;
  changeEmail: () => void;
}) {
  return <div className="verification-actions">
    <button type="button" className="text-button" disabled={busy || cooldown > 0} onClick={() => void resend()}>
      {busy ? "正在处理…" : cooldown > 0 ? `${cooldown} 秒后可重新发送` : "重新发送验证码"}
    </button>
    <button type="button" className="text-button" disabled={busy} onClick={changeEmail}>更换邮箱</button>
  </div>;
}
