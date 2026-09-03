import type { SendMailOptions, SentMessageInfo, Transport } from "../src/types";

export interface FakeTransportOptions {
  /**
   * Destinatarios que el "servidor SMTP" va a rechazar en `RCPT TO`.
   * Igual que nodemailer: si rechaza algunos, `sendMail` resuelve con
   * `rejected` poblado; si rechaza a todos, lanza.
   */
  reject?: string[] | ((address: string) => boolean);
  /** Si se setea, `sendMail` lanza este error antes de hablar con el servidor. */
  failWith?: Error | null;
}

export interface FakeTransport extends Transport {
  /** Cada llamada a sendMail, en orden. */
  calls: SendMailOptions[];
  options: FakeTransportOptions;
}

interface SmtpError extends Error {
  code: string;
  responseCode?: number;
  response?: string;
  rejected?: string[];
}

function smtpError(
  message: string,
  code: string,
  extra: Partial<SmtpError> = {},
): SmtpError {
  return Object.assign(new Error(message) as SmtpError, { code, ...extra });
}

/** Igual que nodemailer: string separado por comas o array → array limpio. */
export function parseAddresses(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : to.split(",");
  return list.map((a) => a.trim()).filter(Boolean);
}

let messageCounter = 0;

/**
 * Transporte con la firma de `nodemailer.createTransport(...).sendMail`.
 *
 * Reproduce el comportamiento del transporte SMTP real:
 * - `messageId` se genera localmente, antes y sin importar lo que diga el servidor.
 * - `accepted` / `rejected` reflejan el `RCPT TO` por destinatario.
 * - Con todos los destinatarios rechazados, lanza `EENVELOPE`.
 * - `response` es la respuesta del servidor al `DATA` (solo si hubo al menos uno aceptado).
 */
export function createFakeTransport(
  options: FakeTransportOptions = {},
): FakeTransport {
  const calls: SendMailOptions[] = [];

  const isRejected = (address: string): boolean => {
    const r = options.reject;
    if (!r) return false;
    return typeof r === "function" ? r(address) : r.includes(address);
  };

  return {
    calls,
    options,
    async sendMail(mail) {
      calls.push(mail);
      if (options.failWith) throw options.failWith;

      const to = parseAddresses(mail.to);
      const domain = mail.from.split("@")[1]?.replace(/>$/, "") ?? "localhost";
      messageCounter += 1;
      const messageId = `<${Date.now().toString(36)}-${messageCounter.toString(36).padStart(4, "0")}@${domain}>`;

      const accepted = to.filter((a) => !isRejected(a));
      const rejected = to.filter((a) => isRejected(a));

      if (accepted.length === 0) {
        throw smtpError(
          "Can't send mail - all recipients were rejected: 550 5.1.1 User unknown",
          "EENVELOPE",
          { responseCode: 550, response: "550 5.1.1 User unknown", rejected },
        );
      }

      return {
        messageId,
        accepted,
        rejected,
        pending: [],
        response: `250 2.0.0 OK  ${Math.floor(Date.now() / 1000)} q${messageCounter}si - fake-smtp`,
        envelope: { from: mail.from, to: accepted },
      };
    },
  };
}
