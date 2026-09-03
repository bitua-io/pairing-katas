import type { Logger } from "../src/types";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogLine {
  level: LogLevel;
  message: string;
  meta?: unknown;
}

export interface FakeLogger extends Logger {
  lines: LogLine[];
  /** Solo los mensajes (sin meta) de un nivel, o de todos si no se indica. */
  messages(level?: LogLevel): string[];
  /** Volcado legible, como se vería en `docker logs`. */
  dump(): string;
  clear(): void;
}

/** Logger que acumula líneas en un array en vez de imprimirlas. */
export function createFakeLogger(): FakeLogger {
  const lines: LogLine[] = [];
  const push = (level: LogLevel) => (message: string, meta?: unknown) => {
    lines.push(meta === undefined ? { level, message } : { level, message, meta });
  };

  return {
    lines,
    debug: push("debug"),
    info: push("info"),
    warn: push("warn"),
    error: push("error"),
    messages(level) {
      return lines
        .filter((l) => level === undefined || l.level === level)
        .map((l) => l.message);
    },
    dump() {
      return lines
        .map((l) => {
          const meta =
            l.meta === undefined ? "" : ` ${safeStringify(l.meta)}`;
          return `${l.level.toUpperCase().padEnd(5)} ${l.message}${meta}`;
        })
        .join("\n");
    },
    clear() {
      lines.length = 0;
    },
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) =>
      v instanceof Error ? { message: v.message } : v,
    );
  } catch {
    return String(value);
  }
}
