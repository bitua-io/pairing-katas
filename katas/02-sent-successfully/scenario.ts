/**
 * Reproduce el incidente: el log dice "sent successfully" pero 3 de 5
 * destinatarios nunca recibieron el correo.
 *
 * Correr con: bun run scenario.ts
 * Hoy este escenario FALLA. El objetivo de la kata es que pase.
 */
import { createFakeLogger } from "./fakes/logger";
import { createFakeTransport } from "./fakes/transport";
import { createEmailService } from "./src/email.service";

const recipients = [
  "ops-1@example.org",
  "ops-2@example.org",
  "ops-3@example.org",
  "ops-4@example.org",
  "ops-5@example.org",
];

// El servidor SMTP del cliente rechaza tres casillas (dadas de baja).
const rejected = ["ops-2@example.org", "ops-4@example.org", "ops-5@example.org"];

const logger = createFakeLogger();
const transport = createFakeTransport({ reject: rejected });
const service = createEmailService(
  { from: "notificaciones@example.org", recipients },
  { transport, logger },
);

console.log(`── Enviando correo de reserva a ${recipients.length} destinatarios.`);
console.log(`   El servidor va a rechazar ${rejected.length}: ${rejected.join(", ")}`);

let thrown: unknown = null;
try {
  await service.sendReservationEmail(
    {
      "Creado por": "Operador de turno",
      Institución: "Hospital Demo",
      "Fecha corta": "3 sep 09:30",
      Contenedor: "container-01",
    },
    2,
  );
} catch (err) {
  thrown = err;
}

console.log("\n── Log del servicio:");
console.log(logger.dump().replace(/^/gm, "   "));

const failures: string[] = [];
const saidSuccess = logger
  .messages("info")
  .some((m) => m.includes("sent successfully"));
const warnedRejected = logger
  .messages("warn")
  .some((m) => rejected.every((r) => m.includes(r)));

if (thrown) {
  failures.push(`sendMail no debería lanzar en un rechazo parcial: ${String(thrown)}`);
}
if (saidSuccess && !warnedRejected) {
  failures.push(
    `El log dice "sent successfully" pero ${rejected.length} de ${recipients.length} destinatarios fueron rechazados y nadie lo registró.`,
  );
}
if (!warnedRejected) {
  failures.push("Falta una línea de nivel warn con la lista de destinatarios rechazados.");
}

if (failures.length > 0) {
  console.log("\n✗ ESCENARIO FALLIDO");
  for (const f of failures) console.log(`   - ${f}`);
  console.log(
    "\n   Para pensar: ¿qué información devuelve el transporte que el servicio no está leyendo?",
  );
  process.exit(1);
}

console.log("\n✓ ESCENARIO OK: el rechazo parcial quedó registrado.");
