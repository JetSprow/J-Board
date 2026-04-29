type ErrorLikeRecord = Record<string, unknown>;

const REDACTED_SERVER_COMPONENT_ERROR = /An error occurred in the Server Components render/i;
const DETAIL_KEYS = ["error", "message", "detail", "details", "reason", "description"];
const CODE_KEYS = ["code", "status", "statusCode", "digest"];

function normalizeMessage(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  if (REDACTED_SERVER_COMPONENT_ERROR.test(trimmed)) {
    return "服务端渲染时发生异常，生产环境已隐藏原始堆栈";
  }

  return trimmed;
}

function isRecord(value: unknown): value is ErrorLikeRecord {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function pushUnique(messages: string[], value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return;
  const normalized = normalizeMessage(String(value));
  if (normalized && !messages.includes(normalized)) messages.push(normalized);
}

function collectFromArray(messages: string[], value: unknown) {
  if (!Array.isArray(value)) return;

  for (const item of value) {
    if (typeof item === "string") {
      pushUnique(messages, item);
      continue;
    }
    if (!isRecord(item)) continue;
    const path = Array.isArray(item.path) ? item.path.join(".") : null;
    const message = typeof item.message === "string" ? item.message : null;
    if (message) pushUnique(messages, path ? `${path}：${message}` : message);
  }
}

function collectErrorMessages(error: unknown, messages: string[], seen = new WeakSet<object>()) {
  if (error instanceof Error) {
    pushUnique(messages, error.message);
    const digest = (error as Error & { digest?: unknown }).digest;
    if (digest) pushUnique(messages, `错误编号：${String(digest)}`);
    if (error.cause) collectErrorMessages(error.cause, messages, seen);
    return;
  }

  if (typeof error === "string") {
    pushUnique(messages, error);
    return;
  }

  if (!isRecord(error)) return;
  if (seen.has(error)) return;
  seen.add(error);

  for (const key of DETAIL_KEYS) {
    const value = error[key];
    if (typeof value === "string") {
      pushUnique(messages, value);
    } else if (Array.isArray(value)) {
      collectFromArray(messages, value);
    } else if (isRecord(value)) {
      collectErrorMessages(value, messages, seen);
    }
  }

  for (const key of CODE_KEYS) {
    const value = error[key];
    if (value == null || value === "") continue;
    const label = key === "digest" ? "错误编号" : key;
    pushUnique(messages, `${label}：${String(value)}`);
  }
}

export function getErrorMessage(
  error: unknown,
  fallback = "操作失败",
): string {
  const messages: string[] = [];
  collectErrorMessages(error, messages);

  if (messages.length > 0) {
    return messages.join("；");
  }

  const fallbackMessage = normalizeMessage(fallback) ?? "操作失败";
  const errorType = error === null ? "null" : typeof error;
  return `${fallbackMessage}：请求没有返回可读错误内容（错误类型：${errorType}），请查看服务端日志定位原因。`;
}
