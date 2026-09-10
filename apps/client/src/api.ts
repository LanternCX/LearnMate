import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

export type User = {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
};
let activeUser = "";
let sessionRevision = 0;

export async function modelRequest(
  runId: string,
  payload: object,
  signal?: AbortSignal,
): Promise<Response> {
  return streamingModelRequest(
    "/api/learning/model",
    JSON.stringify({ runId, payload }),
    signal,
  );
}

export async function courseModelRequest(
  agent: "teacher" | "slides",
  payload: object,
  signal?: AbortSignal,
): Promise<Response> {
  return streamingModelRequest(
    "/api/learning/course/model",
    JSON.stringify({ agent, payload }),
    signal,
  );
}

async function streamingModelRequest(
  path: string,
  body: string,
  signal?: AbortSignal,
): Promise<Response> {
  const expectedUser = activeUser;
  const revision = sessionRevision;
  if (!isTauri())
    return fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Zhiya-Request": "1",
        "X-Zhiya-User": expectedUser,
      },
      body,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(120000)])
        : AbortSignal.timeout(120000),
    });
  type Part = { status?: number; bytes?: number[]; done?: boolean };
  return new Promise<Response>((resolve, reject) => {
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    let ended = false;
    const fail = (error: unknown) => {
      if (ended) return;
      ended = true;
      controller.error(error);
      reject(error);
    };
    const channel = new Channel<Part>();
    channel.onmessage = (part) => {
      if (ended) return;
      if (revision !== sessionRevision || signal?.aborted) {
        fail(new Error("会话已中断"));
        return;
      }
      if (part.status)
        resolve(
          new Response(stream, {
            status: part.status,
            headers: { "Content-Type": "text/event-stream" },
          }),
        );
      if (part.bytes) controller.enqueue(new Uint8Array(part.bytes));
      if (part.done) {
        ended = true;
        controller.close();
      }
    };
    signal?.addEventListener("abort", () => fail(new Error("会话已中断")), {
      once: true,
    });
    void invoke("model_request", {
      body,
      expectedUser,
      course: path.endsWith("/course/model"),
      onEvent: channel,
    }).catch(fail);
  });
}
export function setActiveUser(id: string) {
  activeUser = id;
  sessionRevision++;
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
  const expectedRevision = sessionRevision;
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
        signal: AbortSignal.timeout(
          __ZHIYA_CLIENT_CONFIG__.requestTimeoutMilliseconds,
        ),
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
      throw new APIError(0, "无法访问系统安全存储，请解锁后重试");
    if (typeof err === "string" && /application configuration/i.test(err))
      throw new APIError(0, "应用尚未配置服务地址");
    throw new APIError(0, "暂时无法连接，请检查网络后重试");
  }
  let data;
  if (expectedRevision !== sessionRevision)
    throw new APIError(409, "账号已切换，请重新操作");
  try {
    data = JSON.parse(text);
  } catch {
    throw new APIError(status, "服务响应异常，请稍后重试");
  }
  if (status < 200 || status >= 300)
    throw new APIError(status, data.error ?? "操作失败，请重试");
  return data as T;
}
