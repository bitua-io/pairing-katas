import type {
  EmailService,
  OccupiedEmailDetails,
  ReservationEmailDetails,
} from "../src/types";

export interface FakeEmailService extends EmailService {
  scheduled: ReservationEmailDetails[];
  occupied: OccupiedEmailDetails[];
  /** Si se setea, los próximos envíos fallan con este error. */
  failWith: Error | null;
}

/** Servicio de correo que solo registra qué se habría enviado. */
export function createFakeEmailService(): FakeEmailService {
  const scheduled: ReservationEmailDetails[] = [];
  const occupied: OccupiedEmailDetails[] = [];
  const svc: FakeEmailService = {
    scheduled,
    occupied,
    failWith: null,
    async sendReservationEmail(details) {
      if (svc.failWith) throw svc.failWith;
      scheduled.push(details);
    },
    async sendOccupiedEmail(details) {
      if (svc.failWith) throw svc.failWith;
      occupied.push(details);
    },
  };
  return svc;
}
