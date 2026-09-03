/**
 * Interfaces propias de la kata. El código de producción tipa contra PouchDB,
 * acá tipamos contra un subconjunto mínimo para correr sin dependencias.
 */

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface BaseDoc {
  _id: string;
  _rev?: string;
}

export interface DbInfo {
  db_name: string;
  doc_count: number;
  update_seq: number;
}

export interface ChangesOptions {
  since: number | string;
  limit?: number;
  include_docs?: boolean;
}

export interface ChangeRow<T extends BaseDoc> {
  id: string;
  seq: number;
  changes: { rev: string }[];
  doc?: T;
  deleted?: boolean;
}

export interface ChangesResponse<T extends BaseDoc> {
  results: ChangeRow<T>[];
  last_seq: number;
}

/**
 * Selector estilo Mango, subconjunto: igualdad, `$exists`, `$gte`, `$lte`,
 * `$in`, `$ne`.
 */
export type Selector = Record<string, unknown>;

export interface FindRequest {
  selector: Selector;
  limit?: number;
}

export interface FindResponse<T extends BaseDoc> {
  docs: T[];
}

export interface PutResponse {
  ok: true;
  id: string;
  rev: string;
}

export interface Database<T extends BaseDoc = BaseDoc> {
  info(): Promise<DbInfo>;
  changes(options: ChangesOptions): Promise<ChangesResponse<T>>;
  find(request: FindRequest): Promise<FindResponse<T>>;
  put(doc: T): Promise<PutResponse>;
  get(id: string): Promise<T>;
}

export type ReservationStatus =
  | "scheduled"
  | "occupied"
  | "completed"
  | "cancelled";

export interface ReservationDoc extends BaseDoc {
  type: "reservation";
  status: ReservationStatus;
  containerId: string;
  locationId: string;
  createdBy: string;
  createdAt: string;
  occupiedBy?: string;
  occupiedAt?: string;
  /** ISO timestamp: el correo de reserva creada ya fue enviado. */
  scheduledEmailSentAt?: string;
  /** ISO timestamp: el correo de maleta entregada ya fue enviado. */
  occupiedEmailSentAt?: string;
}

export interface ReservationEmailDetails {
  reservationId: string;
  containerId: string;
  locationId: string;
  createdBy: string;
}

export interface OccupiedEmailDetails {
  reservationId: string;
  containerId: string;
  occupiedBy: string;
}

export interface EmailService {
  sendReservationEmail(details: ReservationEmailDetails): Promise<void>;
  sendOccupiedEmail(details: OccupiedEmailDetails): Promise<void>;
}
