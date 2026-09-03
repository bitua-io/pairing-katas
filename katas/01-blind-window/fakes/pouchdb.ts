import type {
  BaseDoc,
  ChangeRow,
  ChangesOptions,
  ChangesResponse,
  Database,
  DbInfo,
  FindRequest,
  FindResponse,
  PutResponse,
  Selector,
} from "../src/types";

/**
 * Base in-memory con la semántica de CouchDB que importa para esta kata:
 * - `update_seq` incremental: cada `put` avanza la secuencia global.
 * - `changes({ since })` devuelve una fila por documento (la última revisión),
 *   ordenadas por seq, solo las de seq > since. Igual que CouchDB, un doc
 *   modificado dos veces aparece una sola vez, en su seq más reciente.
 * - `put` exige el `_rev` actual; si no coincide lanza `{ status: 409 }`.
 * - `get` de un id inexistente lanza `{ status: 404 }`.
 */
export interface FakeDatabase<T extends BaseDoc> extends Database<T> {
  /** Estado crudo, para inspección en tests/escenario. */
  readonly docs: ReadonlyMap<string, T>;
  readonly updateSeq: number;
  /** Atajo: `put` sin `_rev`, o con el `_rev` actual del doc guardado. */
  upsert(patch: Partial<T> & { _id: string }): Promise<T>;
}

interface DbError extends Error {
  status: number;
  name: string;
}

function dbError(status: number, name: string, message: string): DbError {
  const err = new Error(message) as DbError;
  err.status = status;
  err.name = name;
  return err;
}

let revCounter = 0;
function nextRev(prev?: string): string {
  const gen = prev ? Number.parseInt(prev.split("-")[0] ?? "0", 10) + 1 : 1;
  revCounter += 1;
  return `${gen}-${revCounter.toString(16).padStart(8, "0")}`;
}

export function createFakeDatabase<T extends BaseDoc>(
  dbName = "reservations",
): FakeDatabase<T> {
  const docs = new Map<string, T>();
  /** seq por doc (solo la última) */
  const seqByDoc = new Map<string, number>();
  const deleted = new Set<string>();
  let updateSeq = 0;

  function clone<V>(v: V): V {
    return structuredClone(v);
  }

  async function info(): Promise<DbInfo> {
    return {
      db_name: dbName,
      doc_count: docs.size - deleted.size,
      update_seq: updateSeq,
    };
  }

  async function get(id: string): Promise<T> {
    const doc = docs.get(id);
    if (!doc || deleted.has(id)) {
      throw dbError(404, "not_found", "missing");
    }
    return clone(doc);
  }

  async function put(doc: T): Promise<PutResponse> {
    if (!doc._id) throw dbError(400, "bad_request", "Document must have an _id");
    const existing = docs.get(doc._id);
    if (existing && existing._rev !== doc._rev) {
      throw dbError(409, "conflict", "Document update conflict");
    }
    if (!existing && doc._rev) {
      throw dbError(409, "conflict", "Document update conflict");
    }
    const rev = nextRev(existing?._rev);
    updateSeq += 1;
    const stored = clone({ ...doc, _rev: rev });
    docs.set(doc._id, stored);
    seqByDoc.set(doc._id, updateSeq);
    deleted.delete(doc._id);
    return { ok: true, id: doc._id, rev };
  }

  async function upsert(patch: Partial<T> & { _id: string }): Promise<T> {
    const existing = docs.get(patch._id);
    const next = { ...(existing ?? {}), ...patch, _rev: existing?._rev } as T;
    await put(next);
    return get(patch._id);
  }

  async function changes(options: ChangesOptions): Promise<ChangesResponse<T>> {
    const since =
      typeof options.since === "string"
        ? Number.parseInt(options.since, 10) || 0
        : options.since;
    const rows: ChangeRow<T>[] = Array.from(seqByDoc.entries())
      .filter(([, seq]) => seq > since)
      .sort((a, b) => a[1] - b[1])
      .slice(0, options.limit ?? Number.POSITIVE_INFINITY)
      .map(([id, seq]) => {
        const doc = docs.get(id) as T;
        const row: ChangeRow<T> = {
          id,
          seq,
          changes: [{ rev: doc._rev as string }],
        };
        if (deleted.has(id)) row.deleted = true;
        else if (options.include_docs) row.doc = clone(doc);
        return row;
      });
    const last = rows.at(-1);
    return { results: rows, last_seq: last ? last.seq : since };
  }

  async function find(request: FindRequest): Promise<FindResponse<T>> {
    const out: T[] = [];
    for (const [id, doc] of docs) {
      if (deleted.has(id)) continue;
      if (matches(doc as Record<string, unknown>, request.selector)) {
        out.push(clone(doc));
        if (request.limit !== undefined && out.length >= request.limit) break;
      }
    }
    return { docs: out };
  }

  return {
    info,
    get,
    put,
    changes,
    find,
    upsert,
    get docs() {
      return docs;
    },
    get updateSeq() {
      return updateSeq;
    },
  };
}

function matches(doc: Record<string, unknown>, selector: Selector): boolean {
  for (const [field, expected] of Object.entries(selector)) {
    if (field === "$and" && Array.isArray(expected)) {
      if (!expected.every((s) => matches(doc, s as Selector))) return false;
      continue;
    }
    if (field === "$or" && Array.isArray(expected)) {
      if (!expected.some((s) => matches(doc, s as Selector))) return false;
      continue;
    }
    const actual = doc[field];
    if (isOperatorObject(expected)) {
      for (const [op, operand] of Object.entries(expected)) {
        switch (op) {
          case "$exists":
            if ((actual !== undefined) !== Boolean(operand)) return false;
            break;
          case "$eq":
            if (actual !== operand) return false;
            break;
          case "$ne":
            if (actual === operand) return false;
            break;
          case "$gte":
            if (!(typeof actual === typeof operand && (actual as never) >= (operand as never))) return false;
            break;
          case "$gt":
            if (!(typeof actual === typeof operand && (actual as never) > (operand as never))) return false;
            break;
          case "$lte":
            if (!(typeof actual === typeof operand && (actual as never) <= (operand as never))) return false;
            break;
          case "$lt":
            if (!(typeof actual === typeof operand && (actual as never) < (operand as never))) return false;
            break;
          case "$in":
            if (!Array.isArray(operand) || !operand.includes(actual)) return false;
            break;
          default:
            throw new Error(`fakes/pouchdb: operador no soportado ${op}`);
        }
      }
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

function isOperatorObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.keys(v).some((k) => k.startsWith("$"))
  );
}
