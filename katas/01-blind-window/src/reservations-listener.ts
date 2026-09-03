import {
  type ChangesFeedWorker,
  createChangesFeedWorker,
} from "./changes-feed-worker";
import type {
  Database,
  EmailService,
  Logger,
  ReservationDoc,
} from "./types";

export interface ReservationsListenerDeps {
  reservationsDb: Database<ReservationDoc>;
  emailService: EmailService;
  logger: Logger;
  pollIntervalMs?: number;
}

export interface ReservationsListener {
  start(): Promise<void>;
  stop(): Promise<void>;
  isActive(): boolean;
}

const MAX_PREVIOUS_STATUS_SIZE = 1000;

/**
 * Create reservations listener.
 *
 * Escucha el changes feed de la base de reservas y dispara dos correos:
 * - reserva nueva en estado `scheduled` → correo al equipo operativo
 * - transición a `occupied` (maleta entregada) → correo a quien reservó
 */
export function createReservationsListener(
  deps: ReservationsListenerDeps,
): ReservationsListener {
  const { reservationsDb, emailService, logger, pollIntervalMs } = deps;

  let isActive = false;
  let feedWorker: ChangesFeedWorker | null = null;

  // Per-reservation deduplication: track individual reservation IDs already notified
  const processedReservations = new Set<string>();
  const processedOccupiedReservations = new Set<string>();

  // Track previous status for detecting transitions to "occupied"
  const previousStatus = new Map<string, string>();

  /**
   * Mark reservations as notified in CouchDB for cross-process deduplication.
   */
  async function markAsNotified(
    docId: string,
    field: "scheduledEmailSentAt" | "occupiedEmailSentAt",
  ): Promise<void> {
    try {
      const doc = await reservationsDb.get(docId);
      if (!doc[field]) {
        await reservationsDb.put({
          ...doc,
          [field]: new Date().toISOString(),
        });
      }
    } catch (error) {
      // 409 conflict means another process already marked it — safe to ignore
      const status = (error as { status?: number }).status;
      if (status !== 409) {
        logger.debug(
          `[Notifications] Could not mark ${docId} as notified: ${error}`,
        );
      }
    }
  }

  /**
   * Clean up previousStatus map if it exceeds the maximum size
   */
  function cleanupPreviousStatusIfNeeded(): void {
    if (previousStatus.size > MAX_PREVIOUS_STATUS_SIZE) {
      const keysToDelete = Array.from(previousStatus.keys()).slice(
        0,
        previousStatus.size - MAX_PREVIOUS_STATUS_SIZE / 2,
      );
      for (const key of keysToDelete) {
        previousStatus.delete(key);
      }
      logger.debug(
        `[Notifications] Cleaned up previousStatus map, new size: ${previousStatus.size}`,
      );
    }
  }

  /**
   * Handle new scheduled reservation
   */
  async function handleScheduledReservation(doc: ReservationDoc): Promise<void> {
    if (processedReservations.has(doc._id)) {
      logger.debug(
        `[Notifications] Skipping already processed reservation: ${doc._id}`,
      );
      return;
    }
    processedReservations.add(doc._id);

    logger.info(
      `[Notifications] New scheduled reservation detected: ${doc._id}`,
    );

    try {
      await emailService.sendReservationEmail({
        reservationId: doc._id,
        containerId: doc.containerId,
        locationId: doc.locationId,
        createdBy: doc.createdBy,
      });
      await markAsNotified(doc._id, "scheduledEmailSentAt");
      logger.info(
        `[Notifications] Reservation email sent successfully for ${doc._id}`,
      );
    } catch (error) {
      processedReservations.delete(doc._id);
      logger.error("[Notifications] Failed to send reservation email", {
        error,
        reservationId: doc._id,
      });
    }
  }

  /**
   * Handle transition to "occupied": notify the reservation creator.
   */
  async function handleOccupiedTransition(doc: ReservationDoc): Promise<void> {
    // Skip if this occupied transition was already processed
    if (processedOccupiedReservations.has(doc._id)) {
      logger.debug(
        `[Notifications] Skipping already processed occupied transition: ${doc._id}`,
      );
      return;
    }
    processedOccupiedReservations.add(doc._id);

    logger.info(
      `[Notifications] Reservation ${doc._id} transitioned to occupied`,
    );

    try {
      await emailService.sendOccupiedEmail({
        reservationId: doc._id,
        containerId: doc.containerId,
        occupiedBy: doc.occupiedBy ?? "N/A",
      });
      await markAsNotified(doc._id, "occupiedEmailSentAt");
      logger.info(
        `[Notifications] Occupied email sent successfully for ${doc._id}`,
      );
    } catch (error) {
      processedOccupiedReservations.delete(doc._id);
      logger.error("[Notifications] Failed to send occupied email", {
        error,
        reservationId: doc._id,
      });
    }
  }

  async function start(): Promise<void> {
    if (isActive) {
      logger.warn("[Notifications] Reservations listener is already active");
      return;
    }

    logger.info("[Notifications] Starting reservations listener...");
    isActive = true;

    try {
      // Test connection
      const info = await reservationsDb.info();
      logger.info(
        `[Notifications] Connected to reservations database: ${info.db_name} (${info.doc_count} docs)`,
      );

      // The changes-feed loop (checkpoint since update_seq, polling,
      // design-doc skip, fault tolerance) is the shared
      // createChangesFeedWorker primitive; this listener keeps the
      // per-change processing.
      feedWorker = createChangesFeedWorker<ReservationDoc>({
        db: reservationsDb,
        logger,
        logPrefix: "[Notifications]",
        pollIntervalMs,
        onChange: async (change) => {
          if (change.doc && !change.deleted) {
            try {
              const doc = change.doc;
              const currentStatus = doc.status;
              const isNewDocument = doc._rev?.startsWith("1-");

              // Track status for occupied transitions
              const prevStatus = previousStatus.get(change.id);
              if (currentStatus) {
                previousStatus.set(change.id, currentStatus);
              }

              cleanupPreviousStatusIfNeeded();

              // Handle transition to "occupied" state
              const isOccupiedTransition =
                currentStatus === "occupied" &&
                prevStatus &&
                prevStatus !== "occupied" &&
                !doc.occupiedEmailSentAt;

              if (isOccupiedTransition) {
                await handleOccupiedTransition(doc);
              }

              // Handle new scheduled reservations
              if (
                isNewDocument &&
                currentStatus === "scheduled" &&
                !doc.scheduledEmailSentAt
              ) {
                await handleScheduledReservation(doc);
              }
            } catch (error) {
              logger.error("[Notifications] Error processing reservation", {
                error,
                reservationId: change.id,
              });
            }
          } else if (change.deleted) {
            logger.info(`[Notifications] Reservation deleted: ${change.id}`);
            previousStatus.delete(change.id);
          }
        },
      });
      await feedWorker.start();

      logger.info("[Notifications] Reservations listener started successfully");
    } catch (error) {
      isActive = false;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[Notifications] Failed to start reservations listener: ${errorMessage}`,
        { error },
      );
      throw new Error(`Failed to start reservations listener: ${errorMessage}`);
    }
  }

  async function stop(): Promise<void> {
    if (!isActive) {
      logger.warn("[Notifications] Reservations listener is not active");
      return;
    }

    logger.info("[Notifications] Stopping reservations listener...");

    previousStatus.clear();
    processedReservations.clear();
    processedOccupiedReservations.clear();

    // Stop polling
    if (feedWorker) {
      feedWorker.stop();
      feedWorker = null;
    }

    isActive = false;
    logger.info("[Notifications] Reservations listener stopped");
  }

  return {
    start,
    stop,
    isActive: () => isActive,
  };
}
