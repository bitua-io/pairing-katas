/**
 * Estos tests describen el comportamiento esperado del servicio de correo.
 * Varios FALLAN hoy a propósito.
 *
 * Contrato buscado: el servicio reporta lo que el servidor SMTP respondió,
 * no lo que el servicio intentó.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { createFakeLogger, type FakeLogger } from "../fakes/logger";
import { createFakeTransport, type FakeTransport } from "../fakes/transport";
import { createEmailService, type EmailService } from "./email.service";
import type { ReservationEmailDetails } from "./types";

/** Forma esperada del retorno de las funciones de envío (hoy devuelven void). */
interface SendResult {
  accepted: string[];
  rejected: string[];
  response: string;
}

const recipients = [
  "ops-1@example.org",
  "ops-2@example.org",
  "ops-3@example.org",
  "ops-4@example.org",
  "ops-5@example.org",
];

const details: ReservationEmailDetails = {
  "Creado por": "Operador de turno",
  Institución: "Hospital Demo",
  "Fecha corta": "3 sep 09:30",
  Contenedor: "container-01",
};

let logger: FakeLogger;
let transport: FakeTransport;
let service: EmailService;

function setup(reject: string[] = []) {
  logger = createFakeLogger();
  transport = createFakeTransport({ reject });
  service = createEmailService(
    { from: "notificaciones@example.org", recipients },
    { transport, logger },
  );
}

beforeEach(() => setup());

describe("email service — camino feliz (hoy pasan)", () => {
  test("manda un solo sendMail con todos los destinatarios", async () => {
    await service.sendReservationEmail(details, 2);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.to).toBe(recipients.join(", "));
  });

  test("con lista vacía no llama al transporte y avisa con warn", async () => {
    await service.sendReservationEmail(details, 1, []);
    expect(transport.calls).toHaveLength(0);
    expect(logger.messages("warn")).toHaveLength(1);
  });

  test("si el servidor rechaza a todos, loguea error y relanza", async () => {
    setup(recipients);
    await expect(service.sendReservationEmail(details, 1)).rejects.toThrow(
      /all recipients were rejected/,
    );
    expect(logger.messages("error")).toHaveLength(1);
  });
});

describe("email service — rechazo parcial (hoy fallan)", () => {
  const rejected = ["ops-2@example.org", "ops-4@example.org"];

  test("loguea warn con la lista de destinatarios rechazados", async () => {
    setup(rejected);
    await service.sendReservationEmail(details, 2);

    const warns = logger.messages("warn");
    expect(warns).toHaveLength(1);
    for (const r of rejected) expect(warns[0]).toContain(r);
  });

  test("no dice 'sent successfully' cuando hubo rechazados", async () => {
    setup(rejected);
    await service.sendReservationEmail(details, 2);

    const infos = logger.messages("info");
    expect(infos.some((m) => m.includes("sent successfully"))).toBe(false);
  });

  test("no lanza: el rechazo parcial no es un error total", async () => {
    setup(rejected);
    await expect(service.sendReservationEmail(details, 2)).resolves.toBeDefined();
  });
});

describe("email service — retorno (hoy fallan)", () => {
  test("sendReservationEmail devuelve accepted, rejected y response", async () => {
    setup(["ops-3@example.org"]);
    const result = (await service.sendReservationEmail(
      details,
      1,
    )) as unknown as SendResult;

    expect(result).toBeDefined();
    expect(result.accepted.sort()).toEqual(
      recipients.filter((r) => r !== "ops-3@example.org").sort(),
    );
    expect(result.rejected).toEqual(["ops-3@example.org"]);
    expect(result.response).toMatch(/^250 /);
  });

  test("sendOccupiedEmail devuelve accepted, rejected y response", async () => {
    const result = (await service.sendOccupiedEmail(
      {
        Institución: "Hospital Demo",
        "Código de maleta": "MAL-001",
        "Actualizado por": "Operador de turno",
      },
      "user-01@example.org",
    )) as unknown as SendResult;

    expect(result).toBeDefined();
    expect(result.accepted).toEqual(["user-01@example.org"]);
    expect(result.rejected).toEqual([]);
    expect(result.response).toMatch(/^250 /);
  });
});

describe("email service — PII en logs (hoy fallan)", () => {
  const looksLikeEmail = /[\w.+-]+@[\w-]+\.[\w.]+/;

  test("ningún correo aparece en logs de nivel info al enviar una reserva", async () => {
    await service.sendReservationEmail(details, 2);

    for (const line of logger.lines.filter((l) => l.level === "info")) {
      expect(line.message).not.toMatch(looksLikeEmail);
      expect(JSON.stringify(line.meta ?? {})).not.toMatch(looksLikeEmail);
    }
  });

  test("ningún correo aparece en logs de nivel info al enviar un occupied", async () => {
    await service.sendOccupiedEmail(
      {
        Institución: "Hospital Demo",
        "Código de maleta": "MAL-001",
        "Actualizado por": "Operador de turno",
      },
      "user-01@example.org",
    );

    for (const line of logger.lines.filter((l) => l.level === "info")) {
      expect(line.message).not.toMatch(looksLikeEmail);
      expect(JSON.stringify(line.meta ?? {})).not.toMatch(looksLikeEmail);
    }
  });
});
