import type { OccupiedEmailDetails, ReservationEmailDetails } from "./types";

export const LOGO_CID = "bitua-logo";

function rows(details: object): string {
  return Object.entries(details)
    .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`)
    .join("");
}

function lines(details: object): string {
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

export function formatReservationEmailHTML(
  details: ReservationEmailDetails,
  changesCount: number,
): string {
  return `<img src="cid:${LOGO_CID}" alt="Bitua"/><h2>Nueva reserva (${changesCount} maleta(s))</h2><table>${rows(details)}</table>`;
}

export function formatReservationEmailText(
  details: ReservationEmailDetails,
  changesCount: number,
): string {
  return `Nueva reserva (${changesCount} maleta(s))\n${lines(details)}`;
}

export function formatOccupiedEmailHTML(details: OccupiedEmailDetails): string {
  return `<img src="cid:${LOGO_CID}" alt="Bitua"/><h2>Maleta(s) entregada(s)</h2><table>${rows(details)}</table>`;
}

export function formatOccupiedEmailText(details: OccupiedEmailDetails): string {
  return `Maleta(s) entregada(s)\n${lines(details)}`;
}
