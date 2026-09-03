#!/usr/bin/env bash
# Scaffoldea una kata vacía en katas/NN-<slug>/ y su guion en interviewer/NN-<slug>.md.
# Uso: scripts/new-kata.sh <slug>
set -euo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "Uso: $0 <slug>   (kebab-case, ej: retry-storm)" >&2
  exit 1
fi

slug="$1"
root="$(cd "$(dirname "$0")/.." && pwd)"
katas_dir="$root/katas"

last=$(ls -1 "$katas_dir" 2>/dev/null | grep -E '^[0-9]{2}-' | sort | tail -n1 | cut -c1-2 || true)
next=$(printf "%02d" $(( ${last:-0} + 1 )))
name="$next-$slug"
dir="$katas_dir/$name"

if [[ -e "$dir" ]]; then
  echo "Ya existe $dir" >&2
  exit 1
fi

mkdir -p "$dir/src" "$dir/fakes"

cat > "$dir/package.json" <<JSON
{
  "name": "@bitua/kata-$name",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "scenario": "bun run scenario.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/bun": "^1.2.0",
    "typescript": "^5.6.0"
  }
}
JSON

cat > "$dir/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["bun-types"],
    "verbatimModuleSyntax": true
  },
  "include": ["src", "fakes", "scenario.ts"]
}
JSON

cat > "$dir/README.md" <<MD
# Kata $next · TODO título para el candidato

## El incidente

TODO: relato del incidente tal como lo vería quien lo sufre. Sin pistas de la
causa. Incluí fragmentos de log reales (sanitizados).

## Qué hay en esta carpeta

\`\`\`
src/          código bajo prueba, tipado contra interfaces propias en types.ts
fakes/        dobles in-memory de las dependencias externas
scenario.ts   reproduce el incidente de punta a punta; hoy falla
\`\`\`

## Cómo correr

\`\`\`sh
bun run scenario.ts
bun test
\`\`\`

## El objetivo

1. Explicá qué pasa.
2. Proponé un arreglo y contámelo antes de escribirlo.
3. Implementalo hasta que el escenario y los tests pasen.
MD

cat > "$dir/src/types.ts" <<'TS'
/**
 * Interfaces propias de la kata. Tipamos contra un subconjunto mínimo de las
 * dependencias reales para correr sin instalarlas.
 */

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}
TS

cat > "$dir/fakes/logger.ts" <<'TS'
import type { Logger } from "../src/types";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogLine {
  level: LogLevel;
  message: string;
  meta?: unknown;
}

export interface FakeLogger extends Logger {
  lines: LogLine[];
  messages(level?: LogLevel): string[];
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
          const meta = l.meta === undefined ? "" : ` ${JSON.stringify(l.meta)}`;
          return `${l.level.toUpperCase().padEnd(5)} ${l.message}${meta}`;
        })
        .join("\n");
    },
    clear() {
      lines.length = 0;
    },
  };
}
TS

cat > "$dir/scenario.ts" <<'TS'
/**
 * Reproduce el incidente. Correr con: bun run scenario.ts
 * Hoy este escenario debe FALLAR (exit 1). El objetivo de la kata es que pase.
 */
import { createFakeLogger } from "./fakes/logger";

const logger = createFakeLogger();

// TODO: armar el escenario.
logger.info("[TODO] escenario sin implementar");

console.log(logger.dump());
console.log("\n✗ ESCENARIO FALLIDO: TODO describir qué se esperaba y qué pasó.");
process.exit(1);
TS

cat > "$dir/src/example.test.ts" <<'TS'
import { describe, expect, test } from "bun:test";

describe("TODO nombre del módulo — comportamiento esperado (hoy falla)", () => {
  test("TODO describir el comportamiento esperado", () => {
    expect(true).toBe(false);
  });
});
TS

cat > "$root/interviewer/$name.md" <<MD
# Guion · Kata $next \`$slug\`

**Nivel:** TODO junior/senior · **Duración:** TODO min · **Formato:** pair
programming, el candidato escribe, vos navegás.

**NO compartir esta carpeta.** Compartí solo \`katas/$name/\`.

## El bug, en una línea

TODO

## Timeline sugerido

| Fase | Tiempo | Meta |
|---|---|---|
| 0. Contexto | 5 min | Leen el README juntos. |
| 1. Diagnóstico | TODO | TODO |
| 2. Diseño | TODO | TODO |
| 3. Código | TODO | TODO |
| 4. Cierre | TODO | TODO |

## Fase 1 · Diagnóstico

Pistas escalonadas:

1. TODO
2. TODO
3. TODO

Trampa esperada: TODO

## Fase 2 · Diseño

TODO alternativas y trade-offs.

## Fase 3 · Código

Qué observar: TODO

## Fase 4 · Cierre

Preguntas: TODO

## Rúbrica específica

Además de \`rubric.md\`: TODO
MD

(cd "$dir" && bun install --silent)

echo "Kata creada en katas/$name"
echo "Guion en interviewer/$name.md"
echo
echo "Siguiente paso:"
echo "  cd katas/$name && bun run scenario.ts && bun test"
