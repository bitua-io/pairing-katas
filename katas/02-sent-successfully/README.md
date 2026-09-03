# Kata 02 · "Sent successfully"

## El incidente

Bitua manda un correo al equipo operativo de cada hospital cuando se crea una
reserva de maleta. La lista de destinatarios la configura el cliente y suele
tener entre 3 y 12 casillas.

Soporte recibe este mensaje de un cliente:

> Dos personas del equipo de farmacia dejaron de recibir los avisos de
> reserva hace semanas. El resto los recibe bien. ¿Pueden revisar?

Buscás en el log del servicio de notificaciones y encontrás esto, una vez por
cada reserva:

```
INFO  [Notifications] Sending reservation email to 5 recipient(s): ...
INFO  [Notifications] Reservation email sent successfully {"messageId":"<m1z8k2-0007@example.org>","recipients":"..."}
```

Ningún error. Ningún warning. Según el log, cada correo se envió con éxito a
las 5 casillas.

Preguntando en IT del cliente te enterás de que dos de esas casillas se
dieron de baja hace un mes y una tercera cambió de dominio.

## Qué hay en esta carpeta

```
src/
  email.service.ts        arma y envía los correos de reserva y de entrega
  templates.ts            HTML y texto de los correos
  types.ts                interfaces propias (Transport, SendMailOptions, SentMessageInfo, Logger)
  email.service.test.ts
fakes/
  transport.ts            transporte con la firma de sendMail de nodemailer
  logger.ts               acumula líneas de log en un array
scenario.ts               reproduce el incidente
```

Todo corre sin SMTP real. `fakes/transport.ts` imita cómo responde un servidor
SMTP a través de nodemailer; leelo cuando lo necesites.

## Cómo correr

```sh
bun run scenario.ts   # reproduce el incidente; hoy falla
bun test              # 3 pasan, 7 fallan; describen el comportamiento esperado
```

## El objetivo

1. Explicá por qué el log dice "sent successfully" si tres personas no
   recibieron nada.
2. Proponé qué debería loguear y devolver el servicio. Contámelo antes de
   escribirlo.
3. Implementalo hasta que `bun run scenario.ts` y `bun test` pasen.

Los tests que pasan hoy tienen que seguir pasando.
