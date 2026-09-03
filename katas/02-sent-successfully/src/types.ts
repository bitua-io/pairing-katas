/**
 * Interfaces propias de la kata. Producción tipa contra nodemailer; acá
 * copiamos solo la forma de `sendMail` que importa.
 */

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface Attachment {
  filename: string;
  content?: string | Uint8Array;
  path?: string;
  cid?: string;
  contentType?: string;
}

export interface SendMailOptions {
  from: string;
  /** Uno o varios destinatarios. nodemailer acepta string separado por comas o array. */
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
}

/**
 * Lo que devuelve `transporter.sendMail` en nodemailer (transporte SMTP).
 *
 * - `messageId` lo genera nodemailer del lado del cliente antes de hablar con
 *   el servidor (salvo que vos lo pases en las opciones).
 * - `accepted` / `rejected` son las direcciones que el servidor SMTP aceptó o
 *   rechazó en la fase `RCPT TO`.
 * - `response` es la última línea que respondió el servidor (al `DATA`).
 */
export interface SentMessageInfo {
  messageId: string;
  accepted: string[];
  rejected: string[];
  pending: string[];
  response: string;
  envelope: { from: string; to: string[] };
}

export interface Transport {
  sendMail(options: SendMailOptions): Promise<SentMessageInfo>;
}

export interface ReservationEmailDetails {
  "Creado por": string;
  Institución: string;
  "Fecha corta": string;
  Contenedor: string;
}

export interface OccupiedEmailDetails {
  Institución: string;
  "Código de maleta": string;
  "Actualizado por": string;
}
