# Kata 01 · Reservas que no avisan

## El incidente

Bitua opera armarios inteligentes en hospitales. Cuando alguien reserva una
maleta, el equipo operativo recibe un correo. Cuando la maleta se entrega
(la reserva pasa a `occupied`), quien reservó recibe otro correo.

El lunes a la mañana soporte abre un ticket:

> Desde el fin de semana no llegan los correos de reserva. Revisamos spam.
> Las reservas existen en el sistema y las maletas se entregaron bien.

Vos entrás al contenedor del worker de notificaciones:

```
$ docker ps
CONTAINER ID   IMAGE                       STATUS
7f3a9c1e2b40   api-notifications:latest    Up About an hour
```

Y el log no muestra ningún error:

```
INFO  [Notifications] Starting reservations listener...
INFO  [Notifications] Connected to reservations database: reservations (1482 docs)
INFO  [Notifications] Changes feed polling from seq: 30417 (every 5000ms)
INFO  [Notifications] Reservations listener started successfully
INFO  [Notifications] New scheduled reservation detected: reservation-9f2c
INFO  [Notifications] Reservation email sent successfully for reservation-9f2c
```

Algunas reservas notifican. Otras no. Las que no notifican no aparecen en el
log en absoluto: ni "detected", ni "sent", ni error.

## Qué hay en esta carpeta

```
src/
  changes-feed-worker.ts     lee el changes feed de CouchDB en polling
  reservations-listener.ts   decide qué reservas notificar
  types.ts                   interfaces propias (Database, Logger, ReservationDoc)
  reservations-listener.test.ts
fakes/
  pouchdb.ts                 base in-memory con la semántica de CouchDB que importa
  email-service.ts           registra qué correos se habrían enviado
  logger.ts                  acumula líneas de log en un array
  clock.ts                   helpers de espera para el polling
scenario.ts                  reproduce el incidente de punta a punta
```

Todo corre sin CouchDB ni SMTP. Los fakes son parte de la kata: podés
leerlos, y si necesitás agregarles algo, hacelo.

## Cómo correr

```sh
bun run scenario.ts   # reproduce el incidente; hoy falla
bun test              # 5 pasan, 6 fallan; describen el comportamiento esperado
```

## El objetivo

1. Explicá por qué algunas reservas no notifican. Usá el escenario y el log.
2. Diseñá un arreglo y contámelo antes de escribirlo.
3. Implementalo hasta que `bun run scenario.ts` y `bun test` pasen.

Los tests que pasan hoy tienen que seguir pasando. Nadie debe recibir un
correo dos veces.

No hay una única respuesta correcta. Vamos a conversar sobre las
alternativas mientras trabajás.
