/**
 * Reproduce el incidente: correos de reserva que nunca llegan después de
 * que el worker de notificaciones estuvo caído un rato.
 *
 * Correr con: bun run scenario.ts
 * Hoy este escenario FALLA. El objetivo de la kata es que pase.
 */
import { createFakeDatabase } from "./fakes/pouchdb";
import { createFakeEmailService } from "./fakes/email-service";
import { createFakeLogger } from "./fakes/logger";
import { FAST_POLL_MS, settle } from "./fakes/clock";
import { createReservationsListener } from "./src/reservations-listener";
import type { ReservationDoc } from "./src/types";

const db = createFakeDatabase<ReservationDoc>("reservations");
const emails = createFakeEmailService();
const logger = createFakeLogger();

function reservation(id: string): ReservationDoc {
  return {
    _id: id,
    type: "reservation",
    status: "scheduled",
    containerId: "container-01",
    locationId: "location-01",
    createdBy: "user-01",
    createdAt: new Date().toISOString(),
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

console.log("── 1. Worker arriba. Se crean las reservas A y C.");
let listener = makeListener();
await listener.start();
await db.put(reservation("reservation-A"));
await db.put(reservation("reservation-C"));
await settle();
const notifiedWhileUp = emails.scheduled.map((e) => e.reservationId);
console.log(`   Correos de reserva enviados: ${JSON.stringify(notifiedWhileUp)}`);

console.log("── 2. El contenedor se cae (worker.stop()).");
await listener.stop();

console.log("── 3. Con el worker caído: se crea la reserva B y C pasa a occupied.");
await db.put(reservation("reservation-B"));
await db.upsert({
  _id: "reservation-C",
  status: "occupied",
  occupiedBy: "user-02",
  occupiedAt: new Date().toISOString(),
});

console.log("── 4. El contenedor vuelve (worker.start()) y se le da tiempo.");
listener = makeListener();
await listener.start();
await settle();
await listener.stop();

const scheduledIds = emails.scheduled.map((e) => e.reservationId);
const occupiedIds = emails.occupied.map((e) => e.reservationId);

console.log("\n── Log del worker:");
console.log(logger.dump().replace(/^/gm, "   "));

console.log("\n── Resultado:");
console.log(`   Correos de reserva creada:  ${JSON.stringify(scheduledIds)}`);
console.log(`   Correos de maleta entregada: ${JSON.stringify(occupiedIds)}`);

const failures: string[] = [];
if (!scheduledIds.includes("reservation-B")) {
  failures.push("reservation-B se creó y nadie recibió el correo de reserva.");
}
if (!occupiedIds.includes("reservation-C")) {
  failures.push(
    "reservation-C pasó a occupied y quien reservó no recibió el correo.",
  );
}
if (scheduledIds.filter((id) => id === "reservation-A").length !== 1) {
  failures.push("reservation-A debería notificarse exactamente una vez.");
}

if (failures.length > 0) {
  console.log("\n✗ ESCENARIO FALLIDO");
  for (const f of failures) console.log(`   - ${f}`);
  console.log(
    "\n   Pista para empezar: compará las dos líneas `Changes feed polling from seq:` del log de arriba.",
  );
  process.exit(1);
}

console.log("\n✓ ESCENARIO OK: todas las reservas notificaron, cada una una sola vez.");
