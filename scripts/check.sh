#!/usr/bin/env bash
# Verifica que cada kata esté en el estado esperado para una entrevista:
# el escenario falla (exit != 0), los tests corren y hay al menos uno rojo,
# y el typecheck pasa.
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
status=0

for dir in "$root"/katas/*/; do
  name=$(basename "$dir")
  printf '%-28s' "$name"
  cd "$dir" || { echo "no se pudo entrar"; status=1; continue; }
  [[ -d node_modules ]] || bun install --silent >/dev/null 2>&1

  if bun run scenario.ts >/dev/null 2>&1; then
    printf 'scenario: PASA (debería fallar)  '
    status=1
  else
    printf 'scenario: falla ✓  '
  fi

  out=$(bun test 2>&1)
  pass=$(grep -oE '^ *[0-9]+ pass' <<<"$out" | grep -oE '[0-9]+' || echo 0)
  fail=$(grep -oE '^ *[0-9]+ fail' <<<"$out" | grep -oE '[0-9]+' || echo 0)
  if [[ "$fail" -gt 0 ]]; then
    printf 'tests: %s pass / %s fail ✓  ' "$pass" "$fail"
  else
    printf 'tests: %s pass / %s fail (debería haber rojos)  ' "$pass" "$fail"
    status=1
  fi

  if bunx tsc --noEmit >/dev/null 2>&1; then
    echo 'tsc ✓'
  else
    echo 'tsc ✗'
    status=1
  fi
done

exit $status
