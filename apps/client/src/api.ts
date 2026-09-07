import { invoke, isTauri } from "@tauri-apps/api/core";

export type User = {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
};
let activeUser = "";
export function setActiveUser(id: string) {
  activeUser = id;
}
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = { ok: boolean }>(
  path: string,
  method = "GET",
  body?: object,
): Promise<T> {
  const expectedUser = activeUser;
  let status: number;
  let text: string;
  try {
    if (isTauri()) {
      const response = await invoke<{ status: number; body: string }>(
        "account_request",
        {
          path,
          method,
          body: body ? JSON.stringify(body) : null,
          expectedUser,
        },
      );
      status = response.status;
      text = response.body;
    } else {
      const response = await fetch(`/api${path}`, {
        method,
        credentials: "same-origin",
        signal: AbortSignal.timeout(25000),
        headers: {
          "Content-Type": "application/json",
          "X-Zhiya-Request": "1",
          "X-Zhiya-User": expectedUser,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      status = response.status;
      text = await response.text();
    }
  } catch (err) {
    if (typeof err === "string" && /secure storage/i.test(err))
      throw new APIError(0, "无法访问系统安全存储，请解锁后重试。");
    if (typeof err === "string" && /ZHIYA_API_URL/.test(err))
      throw new APIError(0, "应用尚未配置服务地址。");
    throw new APIError(0, "暂时无法连接，请检查网络后重试。");
  }
  let data;
  if (expectedUser !== activeUser)
    throw new APIError(409, "账号已切换，请重新操作。");
  try {
    data = JSON.parse(text);
  } catch {
    throw new APIError(status, "服务响应异常，请稍后重试。");
  }
  if (status < 200 || status >= 300)
    throw new APIError(status, data.error ?? "操作失败，请重试。");
  return data as T;
}
