import { getErrorMessage } from "./errors";

function extractApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error.trim();
  return getErrorMessage(payload, "请求失败");
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const raw = await response.text();

  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      throw new Error(
        response.ok
          ? "服务器返回了无法解析的响应"
          : `请求失败 (HTTP ${response.status})`,
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      extractApiError(payload) ?? `请求失败 (HTTP ${response.status})`,
    );
  }

  if (payload == null) {
    throw new Error("服务器返回了空响应");
  }

  return payload as T;
}

export function toClientError(error: unknown, fallback: string): Error {
  return new Error(getErrorMessage(error, fallback));
}
