import type { BaseDoc, ChangeRow, Database, Logger } from "./types";

/** Delay between changes-feed polls (also the delay before the first one). */
export const DEFAULT_CHANGES_POLL_INTERVAL_MS = 5_000;
/** Max changes fetched per poll. */
export const DEFAULT_CHANGES_BATCH_LIMIT = 100;

export interface ChangesFeedWorkerDeps<T extends BaseDoc> {
  db: Database<T>;
  /**
   * Called once per non-design change, including deletions (`change.doc` is
   * absent for those). Filtering and processing are the consumer's business;
   * a throw is logged and the rest of the batch still runs.
   */
  onChange: (change: ChangeRow<T>) => void | Promise<void>;
  logger: Logger;
  /** Log-line identity per consumer, e.g. `"[Notifications]"`. */
  logPrefix: string;
  pollIntervalMs?: number;
  limit?: number;
  includeDocs?: boolean;
  /**
   * Checkpoint to start from. Default: the database's `update_seq` at
   * `start()`, so history is never re-processed. The checkpoint lives in
   * memory — a restart resumes from the then-current seq, same as the
   * pre-extraction listeners.
   */
  initialSince?: string | number;
}

/**
 * CouchDB changes-feed listener with a `since` checkpoint. Extracted from the
 * poll loop the notification listeners kept duplicating.
 *
 * Fault tolerance:
 * - A failed poll is logged and retried on the next tick; `lastSeq` does not
 *   advance, so no change is lost.
 * - A throwing `onChange` is logged and the batch continues — one bad doc
 *   never stalls the feed. The batch's `last_seq` is still checkpointed, so
 *   a persistently-throwing doc is skipped, not retried forever.
 */
export function createChangesFeedWorker<T extends BaseDoc>(
  deps: ChangesFeedWorkerDeps<T>,
) {
  const {
    db,
    onChange,
    logger,
    logPrefix,
    pollIntervalMs = DEFAULT_CHANGES_POLL_INTERVAL_MS,
    limit = DEFAULT_CHANGES_BATCH_LIMIT,
    includeDocs = true,
    initialSince,
  } = deps;
  let active = false;
  let lastSeq: string | number = 0;
  let pollTimeout: ReturnType<typeof setTimeout> | null = null;

  async function poll(): Promise<void> {
    if (!active) return;
    try {
      const changes = await db.changes({
        since: lastSeq,
        include_docs: includeDocs,
        limit,
      });

      if (changes.results.length > 0) {
        logger.debug(`${logPrefix} Polled ${changes.results.length} change(s)`);
      }

      for (const change of changes.results) {
        if (change.id.startsWith("_design/")) continue;
        try {
          await onChange(change);
        } catch (err) {
          logger.error(
            `${logPrefix} Error processing change ${change.id}`,
            err,
          );
        }
      }

      lastSeq = changes.last_seq;
    } catch (err) {
      logger.error(`${logPrefix} Error polling changes feed`, err);
    }

    if (active) {
      pollTimeout = setTimeout(() => {
        poll().catch((err) =>
          logger.error(`${logPrefix} Changes poll failed`, err),
        );
      }, pollIntervalMs);
    }
  }

  async function start(): Promise<void> {
    if (active) return;
    active = true;

    if (initialSince !== undefined) {
      lastSeq = initialSince;
    } else {
      const info = await db.info();
      lastSeq = info.update_seq;
    }
    logger.info(
      `${logPrefix} Changes feed polling from seq: ${lastSeq} (every ${pollIntervalMs}ms)`,
    );

    pollTimeout = setTimeout(() => {
      poll().catch((err) =>
        logger.error(`${logPrefix} Changes poll failed`, err),
      );
    }, pollIntervalMs);
  }

  function stop(): void {
    active = false;
    if (pollTimeout) {
      clearTimeout(pollTimeout);
      pollTimeout = null;
    }
  }

  return {
    start,
    stop,
    get lastSeq() {
      return lastSeq;
    },
    get isActive() {
      return active;
    },
  };
}

export type ChangesFeedWorker = ReturnType<typeof createChangesFeedWorker>;
