# Guion · Kata 01 `blind-window`

**Nivel:** senior · **Duración:** 75-90 min · **Formato:** pair programming,
el candidato escribe, vos navegás.

**NO compartir esta carpeta.** Compartí solo `katas/01-blind-window/`.

## El bug, en una línea

El worker arranca el changes feed desde el `update_seq` actual y el
checkpoint vive en memoria. Todo cambio ocurrido mientras el proceso estaba
caído queda en una ventana ciega y nunca se procesa. Además, la detección de
la transición a `occupied` depende de un `previousStatus` en memoria que se
pierde con cada reinicio, así que incluso cambios que el feed sí entrega
después de arrancar se ignoran.

Origen: `changes-feed-worker.ts` (`start()` toma `info.update_seq`) más el
listener de reservas (`isOccupiedTransition` exige `prevStatus`).

## Timeline sugerido

| Fase | Tiempo | Meta |
|---|---|---|
| 0. Contexto | 5 min | Leen el README juntos. Aclarás dominio, no causa. |
| 1. Diagnóstico | 20-25 min | Que nombre la ventana ciega con evidencia del log. |
| 2. Diseño | 15-20 min | Que elija entre checkpoint persistido y barrido, y justifique. |
| 3. Código | 30-35 min | Tests verdes, escenario verde, sin duplicados. |
| 4. Cierre | 10 min | Preguntas de producción: ventana a barrer, PRs, flags. |

Si va rápido, la fase 3 puede incluir el segundo problema (`previousStatus`).
Si va lento, cortá la fase 3 cuando pase el primer test de "ventana ciega" y
dedicá el resto a diseño verbal.

## Fase 1 · Diagnóstico

Dejalo correr `bun run scenario.ts` y leer el log. Buenas señales:

- Compara las dos líneas `Changes feed polling from seq:` (0 y 6) y pregunta
  qué pasó con las seqs intermedias.
- Abre `changes-feed-worker.ts` y encuentra `lastSeq = info.update_seq` en
  `start()`. Lee el comentario del `initialSince` que lo dice explícito.
- Conecta con el incidente: `Up About an hour` = el contenedor se reinició.
  Las reservas creadas en la hora anterior al reinicio están en la ventana.
- Pregunta si el checkpoint se persiste en algún lado. No.

Pistas escalonadas, solo si se traba más de 5 min:

1. "¿Qué significa el número después de `polling from seq:`? ¿De dónde sale?"
2. "En el escenario, ¿cuántos `put` hubo entre el stop y el start?"
3. "¿Qué pasa con `lastSeq` cuando el proceso muere?"

Trampa esperada: que vaya directo a `stop()` y vea el `previousStatus.clear()`
y crea que ese es "el" bug. Es un bug real pero secundario. Preguntá: "si
comentás ese clear, ¿el test de `r-down-1` pasa?" (no).

## Fase 2 · Diseño

Pedile que te cuente el arreglo antes de escribir. Dos familias válidas:

**A. Checkpoint persistido.** Guardar `last_seq` en un doc de la base (o en
otra base) y arrancar desde ahí.

- A favor: procesa exactamente lo que se perdió, nada más. Generaliza a
  otros consumidores del worker.
- En contra: primer arranque sin checkpoint sigue ciego. Si el checkpoint es
  muy viejo, reprocesa miles de cambios. Requiere escribir el checkpoint
  después de procesar, no antes (y decidir qué pasa si el proceso muere
  entre ambos). No arregla el `previousStatus`.

**B. Barrido idempotente al arrancar.** Antes o al arrancar el feed, `find()`
de reservas que necesitan correo y aún no lo tienen:
`status: scheduled` sin `scheduledEmailSentAt`, `status: occupied` sin
`occupiedEmailSentAt`. Decidir por el estado del doc.

- A favor: no depende de memoria. Autocorrige cualquier ventana, incluida la
  del primer arranque. Los campos `*EmailSentAt` ya existen y ya se escriben.
- En contra: hay que acotar la ventana (¿reservas de hace un año sin flag?).
  Un `find` sin índice sobre 100k docs duele. Si el barrido y el feed
  procesan el mismo doc, la idempotencia tiene que estar en el doc, no en un
  Set.

**Lo que querés escuchar:** que B (o A+B) es más robusto porque la fuente de
verdad es el doc, y que la misma regla "decido por estado del doc, no por
transición en memoria" también arregla `previousStatus`. Un senior debería
llegar a "el `isOccupiedTransition` debería ser `status === 'occupied' &&
!occupiedEmailSentAt`, y listo".

Trampa de diseño: proponer `initialSince: 0`. Preguntá qué pasa con 30k
cambios históricos y con los correos ya enviados. Si dice "por eso está el
flag `scheduledEmailSentAt`", está entendiendo idempotencia. Si dice "los
filtro con un Set en memoria", volvé a preguntar qué pasa al reiniciar.

## Fase 3 · Código

Qué observar:

- Escribe el `find()` con selector y lo prueba contra el fake antes de
  integrarlo. Lee `fakes/pouchdb.ts` para ver qué operadores soporta.
- Mantiene la idempotencia en el doc: relee el doc antes de enviar o confía
  en `markAsNotified` con 409. Que sepa explicar el orden enviar → marcar y
  la ventana de doble envío que eso deja (y que diga que es aceptable frente
  a no enviar).
- No rompe los tests verdes. Corre `bun test` seguido.
- Al tocar `isOccupiedTransition`, entiende por qué el test "una reserva que
  ya nació occupied" también debe pasar.
- Si mete el barrido dentro de `start()` antes de `feedWorker.start()`,
  pregúntale qué pasa si el barrido tarda 30 s: ¿bloquea el arranque? ¿Está
  bien?

Trampa de código: hacer el barrido con `changes({ since: 0 })` en vez de
`find()`. Funciona en el fake, pero pregúntale cuánto cuesta en CouchDB real
con 30k seqs y si el resultado incluye docs borrados.

Trampa de código 2: borrar `processedReservations` y `previousStatus`
totalmente. Está bien borrar `previousStatus`. `processedReservations`
protege contra el feed entregando el mismo doc dos veces en el mismo
proceso antes de que `markAsNotified` persista. Que argumente si lo saca.

## Fase 4 · Cierre

Preguntas, elegí 2 o 3:

1. **Ventana a barrer.** "¿Barrés todas las reservas sin flag o solo las de
   las últimas N horas? ¿Cómo elegís N?" Buscás: N relacionado con el peor
   downtime esperado más margen, y que note que una reserva de hace 3 meses
   sin flag probablemente no quiere un correo hoy. Bonus: filtrar por
   `createdAt >= now - N` u `occupiedAt`, y necesidad de índice Mango.
2. **PRs y feature flags.** "¿Cómo lo dividís para mergear sin miedo?"
   Buscás algo como: PR1 barrido detrás de flag apagado + tests; PR2 cambio
   de `isOccupiedTransition`; PR3 prender flag en un tenant, mirar métricas
   de correos enviados, prender en todos; PR4 borrar flag y `previousStatus`.
   Que mencione qué métrica miraría (correos/hora, duplicados reportados).
3. **Observabilidad.** "¿Qué log o métrica te hubiera avisado antes?"
   Buscás: contar reservas sin flag más viejas que X minutos, o loguear al
   arrancar cuántas seqs se saltó (`update_seq` actual vs último visto).
4. **Otros consumidores.** El worker es compartido. "¿El arreglo va en el
   worker o en el listener?" Buscás: el barrido es del dominio (listener); un
   checkpoint persistido sería del worker. Que distinga.

## Rúbrica específica

Además de `rubric.md`:

- **Diagnóstico:** llegó a la ventana ciega desde el log sin pista 3.
- **Diseño:** nombró el trade-off checkpoint vs barrido y eligió con razón.
- **Idempotencia:** entendió que la verdad vive en el doc, no en memoria.
- **Código:** tests verdes sin romper los previos, sin `since: 0` a ciegas.
- **Producción:** propuso una ventana acotada y un rollout con flag.
