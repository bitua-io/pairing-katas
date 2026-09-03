/** Espera real. El worker usa setTimeout; con intervalos de pocos ms alcanza. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Intervalo de polling para tests y escenario. */
export const FAST_POLL_MS = 5;

/** Tiempo suficiente para que el worker haga varios polls. */
export async function settle(): Promise<void> {
  await sleep(FAST_POLL_MS * 12);
}
