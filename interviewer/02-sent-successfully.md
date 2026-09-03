# Guion · Kata 02 `sent-successfully`

**Nivel:** junior · **Duración:** 45-60 min · **Formato:** pair programming,
el candidato escribe, vos navegás. Tono relajado: es una kata para ver cómo
piensa, no para ver si conoce nodemailer.

**NO compartir esta carpeta.** Compartí solo `katas/02-sent-successfully/`.

## El bug, en una línea

Las funciones de envío ignoran `info.accepted`, `info.rejected` e
`info.response` que devuelve `sendMail`, y loguean "sent successfully" con el
`messageId`, que nodemailer genera localmente antes de hablar con el servidor.
Un rechazo parcial (algunos `RCPT TO` con 550) no lanza, así que el `catch`
nunca corre y el log miente. Bonus: la lista completa de correos va a logs de
nivel info.

## Timeline sugerido

| Fase | Tiempo | Meta |
|---|---|---|
| 0. Contexto | 5 min | Leen el README juntos. Aclarás el dominio. |
| 1. Diagnóstico | 15 min | Que descubra qué devuelve `sendMail` y qué es `messageId`. |
| 2. Diseño | 10 min | Que decida qué loguear, a qué nivel, y qué devolver. |
| 3. Código | 20-25 min | Tests verdes, escenario verde. |
| 4. Cierre | 5-10 min | PII en logs, error total vs parcial, qué haría en prod. |

## Fase 1 · Diagnóstico

Que corra `bun run scenario.ts` y lea el log. Dejalo explorar 5 min solo.

Pistas escalonadas, en orden, solo si se traba:

1. **"¿Qué devuelve `sendMail`?"** Queremos que abra `src/types.ts` o
   `fakes/transport.ts` y lea `SentMessageInfo`. Un junior que lee la firma
   antes de asumir ya está bien encaminado. Si dice "devuelve el messageId"
   pedile que lea el resto del tipo.
2. **"¿El `messageId` lo genera quién?"** Queremos que note (por el
   comentario en `types.ts` o por el código del fake) que se genera del lado
   del cliente. Entonces `messageId` presente no prueba nada sobre la
   entrega. Buena frase: "es un ID de correlación, no un acuse".
3. Si todavía no llega: "¿Por qué no entró al `catch`?" Que distinga error
   total (lanza) de rechazo parcial (resuelve con `rejected` poblado).

Qué observar:

- Lee la firma / el tipo antes de asumir qué contiene `info`.
- Distingue error total de rechazo parcial sin que se lo digas.
- Pregunta antes de codear: "¿un rechazo parcial es warn o error?", "¿debería
  lanzar?", "¿qué hace el que llama con el retorno?". Cualquiera de estas
  preguntas es una señal muy buena.

## Fase 2 · Diseño

Pedile que diga en voz alta qué va a cambiar. Respuesta que buscás:

- Leer `info.accepted`, `info.rejected`, `info.response`.
- Si `rejected.length > 0`: `logger.warn` con la lista de rechazados y
  cuántos de cuántos. Si no: `logger.info` "sent" con conteos, no correos.
- Devolver `{ accepted, rejected, response }` para que quien llama decida
  (reintentar, marcar la casilla como inválida, avisar al cliente).
- No lanzar en rechazo parcial. Lanzar sigue siendo correcto cuando el
  transporte lanza (error total).

Preguntas para empujar si se queda corto:

- "¿Warn o error? ¿Quién mira cada nivel?"
- "Si el servicio devuelve `void`, ¿cómo se entera el que llama?"
- "¿Qué pasa si `rejected` tiene a todos?" (el fake lanza, como nodemailer;
  que lo verifique corriendo el test que ya pasa).

No hace falta que lo resuelva perfecto. Hace falta que lo piense antes de
escribir.

## Fase 3 · Código

Qué observar:

- Corre `bun test` seguido y lee qué test falla y por qué. Un junior que lee
  el mensaje del test antes de cambiar código va bien.
- Cambia el tipo de retorno de `Promise<void>` a algo concreto y actualiza la
  interfaz `EmailService`. Si solo devuelve `info` completo, preguntá si
  quiere exponer `envelope` y `messageId` al que llama o solo lo que importa.
- Ve la duplicación entre `sendReservationEmail` y `sendOccupiedEmail`. No es
  obligatorio que la elimine; sí es buena señal que la nombre.
- Para el test de PII: reemplaza la lista de correos en `info` por un conteo,
  y deja los rechazados en `warn`. Pregúntale por qué está bien en `warn`
  y no en `info` (operativo vs ruido; volumen; quién lee cada nivel).

Trampa esperada: que compare `info.accepted.length === targetRecipients.length`
usando `targetRecipients` en vez de `info.rejected`. Funciona, pero preguntá
qué pasa si el servidor devuelve direcciones normalizadas (minúsculas, sin
espacios). `rejected` es la fuente.

Trampa 2: que agregue el warn y deje también el "sent successfully". El test
"no dice 'sent successfully'" lo atrapa. Que lea el test y entienda por qué.

## Fase 4 · Cierre

Elegí 2:

1. **PII en logs.** "¿Por qué no queremos correos en logs de nivel info?"
   Buscás: los logs se guardan semanas, los lee gente que no debería ver
   datos de pacientes/personal, y en algunos países es dato personal. Bonus:
   ¿cómo loguearías para poder debuggear igual? (hash, dominio solo, conteo,
   ID de reserva).
2. **Error total vs parcial.** "¿Cuándo tiene sentido lanzar y cuándo
   devolver?" Buscás: lanzar cuando nada salió, devolver cuando el que llama
   puede hacer algo distinto con partes del resultado.
3. **Qué harías en producción.** "Ya sabés que 3 casillas rebotan siempre.
   ¿Y ahora?" Buscás: avisar al cliente, guardar el rebote, dejar de mandar
   a esas casillas después de N rebotes, métrica de rechazos por tenant.
4. **`messageId`.** "¿Para qué sirve entonces?" Buscás: correlación con el
   servidor SMTP y con el buzón del destinatario; útil en soporte, no como
   confirmación.

## Rúbrica específica

Además de `rubric.md`:

- **Lee antes de asumir:** abrió el tipo de `sendMail` antes de tocar código.
- **Distingue casos:** error total vs rechazo parcial, warn vs error.
- **Pregunta:** hizo al menos una pregunta de diseño antes de codear.
- **Código:** tests verdes, interfaz actualizada, sin correos en info.
- **Cierre:** entendió por qué el `messageId` no confirma nada.
