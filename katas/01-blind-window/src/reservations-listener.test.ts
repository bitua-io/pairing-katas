/**
 * Estos tests describen el comportamiento esperado del listener después de
 * arreglar el incidente. Hoy varios FALLAN a propósito.
 *
 * Idea central: al arrancar, el listener no puede confiar en nada que viva
 * en memoria (ni el checkpoint del feed ni el estado anterior de cada doc).
 * Lo único durable es el documento en la base: `status`,
 * `scheduledEmailSentAt` y `occupiedEmailSentAt`.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { FAST_POLL_MS, settle } from "../fakes/clock";
import { createFakeEmailService } from "../fakes/email-service";
import { createFakeLogger } from "../fakes/logger";
import { createFakeDatabase } from "../fakes/pouchdb";
import { createReservationsListener } from "./reservations-listener";
import type { ReservationDoc } from "./types";

let db = createFakeDatabase<ReservationDoc>();
let emails = createFakeEmailService();
let logger = createFakeLogger();

function reservation(id: string, overrides: Partial<ReservationDoc> = {}): ReservationDoc {
  return {
    _id: id,
    type: "reservation",
    status: "scheduled",
    containerId: "container-01",
    locationId: "location-01",
    createdBy: "user-01",
    createdAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeListener() {
  return createReservationsListener({
    reservationsDb: db,
    emailService: emails,
    logger,
    pollIntervalMs: FAST_POLL_MS,
  });
}

const scheduledIds = () => emails.scheduled.map((e) => e.reservationId);
const occupiedIds = () => emails.occupied.map((e) => e.reservationId);

beforeEach(() => {
  db = createFakeDatabase<ReservationDoc>();
  emails = createFakeEmailService();
  logger = createFakeLogger();
});

describe("reservations listener — camino feliz (hoy pasan)", () => {
  test("notifica una reserva scheduled creada mientras el worker corre", async () => {
    const listener = makeListener();
    await listener.start();
    await db.put(reservation("r1"));
    await settle();
    await listener.stop();

    expect(scheduledIds()).toEqual(["r1"]);
  });

  test("marca scheduledEmailSentAt en el doc después de notificar", async () => {
    const listener = makeListener();
    await listener.start();
    await db.put(reservation("r1"));
    await settle();
    await listener.stop();

    const doc = await db.get("r1");
    expect(doc.scheduledEmailSentAt).toBeString();
  });

  test("notifica la transición a occupied vista en vivo", async () => {
    const listener = makeListener();
    await listener.start();
    await db.put(reservation("r1"));
    await settle();
    await db.upsert({ _id: "r1", status: "occupied", occupiedBy: "user-02" });
    await settle();
    await listener.stop();

    expect(occupiedIds()).toEqual(["r1"]);
    expect((await db.get("r1")).occupiedEmailSentAt).toBeString();
  });
});

describe("reservations listener — ventana ciega (hoy fallan)", () => {
  test("notifica reservas scheduled creadas mientras el worker estaba caído", async () => {
    let listener = makeListener();
    await listener.start();
    await settle();
    await listener.stop();

    // El worker está caído y llegan reservas nuevas.
    await db.put(reservation("r-down-1"));
    await db.put(reservation("r-down-2"));

    listener = makeListener();
    await listener.start();
    await settle();
    await listener.stop();

    expect(scheduledIds().sort()).toEqual(["r-down-1", "r-down-2"]);
  });

  test("notifica la transición a occupied ocurrida mientras el worker estaba caído", async () => {
    let listener = makeListener();
    await listener.start();
    await db.put(reservation("r1"));
    await settle();
    await listener.stop();
    expect(scheduledIds()).toEqual(["r1"]);

    await db.upsert({ _id: "r1", status: "occupied", occupiedBy: "user-02" });

    listener = makeListener();
    await listener.start();
    await settle();
    await listener.stop();

    expect(occupiedIds()).toEqual(["r1"]);
  });

  test("decide por el estado del doc, no por la transición vista en memoria", async () => {
    // r1 se notifica como scheduled en un primer ciclo de vida del proceso.
    let listener = makeListener();
    await listener.start();
    await db.put(reservation("r1"));
    await settle();
    await listener.stop();

    // Segundo ciclo de vida: el proceso arranca sin memoria de r1 y,
    // ya corriendo, r1 pasa a occupied. El feed SÍ entrega este cambio.
    listener = makeListener();
    await listener.start();
    await settle();
    await db.upsert({ _id: "r1", status: "occupied", occupiedBy: "user-02" });
    await settle();
    await listener.stop();

    expect(occupiedIds()).toEqual(["r1"]);
  });

  test("una reserva que ya nació occupied antes de arrancar también notifica", async () => {
    // Ambos correos faltan: nunca se avisó ni la creación ni la entrega.
    await db.put(reservation("r1"));
    await db.upsert({ _id: "r1", status: "occupied", occupiedBy: "user-02" });

    const listener = makeListener();
    await listener.start();
    await settle();
    await listener.stop();

    expect(occupiedIds()).toEqual(["r1"]);
  });

  test("no re-notifica reservas que ya tienen scheduledEmailSentAt", async () => {
    await db.put(
      reservation("r-old", { scheduledEmailSentAt: "2026-01-01T10:05:00.000Z" }),
    );
    await db.put(reservation("r-new"));

    const listener = makeListener();
    await listener.start();
    await settle();
    await listener.stop();

    expect(scheduledIds()).toEqual(["r-new"]);
  });

  test("si el envío falla, no marca el doc y reintenta en el próximo arranque", async () => {
    emails.failWith = new Error("SMTP down");
    let listener = makeListener();
    await listener.start();
    await db.put(reservation("r1"));
    await settle();
    await listener.stop();

    expect(scheduledIds()).toEqual([]);
    expect((await db.get("r1")).scheduledEmailSentAt).toBeUndefined();

    emails.failWith = null;
    listener = makeListener();
    await listener.start();
    await settle();
    await listener.stop();

    expect(scheduledIds()).toEqual(["r1"]);
  });
});

describe("reservations listener — idempotencia (hoy pasan, deben seguir pasando)", () => {

  test("no re-notifica occupied que ya tiene occupiedEmailSentAt", async () => {
    await db.put(
      reservation("r-old", {
        status: "occupied",
        occupiedBy: "user-02",
        scheduledEmailSentAt: "2026-01-01T10:05:00.000Z",
        occupiedEmailSentAt: "2026-01-01T11:00:00.000Z",
      }),
    );

    const listener = makeListener();
    await listener.start();
    await settle();
    await listener.stop();

    expect(occupiedIds()).toEqual([]);
  });

  test("reiniciar varias veces no duplica correos", async () => {
    let listener = makeListener();
    await listener.start();
    await db.put(reservation("r1"));
    await settle();
    await listener.stop();

    for (let i = 0; i < 3; i++) {
      listener = makeListener();
      await listener.start();
      await settle();
      await listener.stop();
    }

    expect(scheduledIds()).toEqual(["r1"]);
  });

});
