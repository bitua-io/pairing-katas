# pairing-katas

Ejercicios de pair programming para entrevistas técnicas y onboarding en
Bitua. Cada kata reproduce un incidente real de nuestra plataforma,
sanitizado y reducido a lo esencial: un bug que se puede ver, diagnosticar y
arreglar en una sesión.

TypeScript + Bun, sin frameworks. Cada kata corre con dos comandos y no
necesita servicios externos.

## Katas

| # | Slug | Nivel | Duración | Tema |
|---|---|---|---|---|
| 01 | `blind-window` | senior | 75-90 min | Worker de changes feed que pierde eventos al reiniciar |
| 02 | `sent-successfully` | junior | 45-60 min | Servicio de correo que loguea éxito ignorando rechazos SMTP |

## Convención de carpetas

```
katas/NN-slug/            una carpeta por kata, autocontenida
  package.json            scripts: scenario, test, typecheck
  README.md               para el candidato: incidente, cómo correr, objetivo
  src/                    código bajo prueba + src/*.test.ts
  src/types.ts            interfaces propias (Database, Transport, Logger...)
  fakes/                  dobles in-memory de las dependencias externas
  scenario.ts             reproduce el incidente de punta a punta; hoy falla
interviewer/NN-slug.md    guion por fases, pistas, trampas, qué observar
interviewer/rubric.md     criterios comunes a todas las katas
scripts/new-kata.sh       scaffoldea una kata vacía
scripts/check.sh          verifica que cada kata está en el estado esperado
```

Reglas de cada kata:

- **Autocontenida.** Corre sin CouchDB, SMTP ni nada externo. Los fakes son
  parte del ejercicio y el candidato puede leerlos y modificarlos.
- **Tipa contra interfaces propias.** `Database`, `Transport`, `Logger` viven
  en `src/types.ts`. No se importan tipos de PouchDB, nodemailer ni de
  ninguna librería.
- **El escenario falla.** `bun run scenario.ts` reproduce el incidente y sale
  con código distinto de cero. Es lo primero que corre el candidato.
- **Los tests describen la solución.** Algunos pasan hoy y deben seguir
  pasando. Otros fallan y describen el comportamiento esperado. La solución
  no está implementada en ningún lado del repo.
- **Sanitizada.** Sin nombres de clientes, correos reales, hostnames ni
  tenants. Se conservan comentarios de código y prefijos de log como
  `[Notifications]` para que se sienta código real.

## Cómo correr una kata

```sh
cd katas/01-blind-window
bun install            # solo tipos para el editor; scenario y test corren sin esto
bun run scenario.ts    # reproduce el incidente
bun test               # tests: algunos verdes, algunos rojos
bun run typecheck      # tsc --noEmit
```

Para verificar todas las katas de una vez (escenario falla, hay tests rojos,
typecheck pasa):

```sh
scripts/check.sh
```

## Cómo compartir una kata en una entrevista

1. Cloná el repo y corré `scripts/check.sh` antes de la sesión.
2. Abrí en el editor **solo la carpeta de la kata**, por ejemplo
   `katas/01-blind-window/`. No abras la raíz del repo.
3. Iniciá Live Share (o el equivalente) desde ese workspace. El candidato ve
   únicamente esa carpeta.
4. Tené `interviewer/NN-slug.md` abierto en otra ventana, fuera del
   workspace compartido.
5. El candidato escribe, vos navegás. Seguí las fases del guion.

### La carpeta `interviewer/` nunca se comparte

Contiene la causa del bug, las pistas, las trampas esperadas y la rúbrica.
Si el candidato la ve, la sesión pierde valor. Por eso:

- Nunca compartas la raíz del repo.
- Nunca pegues fragmentos del guion en el chat de la sesión.
- Si vas a grabar pantalla, verificá qué ventana estás grabando.

El repo es público, así que un candidato podría leer `interviewer/` de
antemano. Asumilo: usá las katas para ver cómo razona y comunica, no para
comprobar si conoce la respuesta. Si querés una prueba a ciegas, escribí una
kata nueva y no la publiques hasta después de usarla.

Si usás el repo para onboarding interno, el guion se puede compartir después
de la sesión como material de repaso.

## Crear una kata nueva

```sh
scripts/new-kata.sh <slug>
```

Crea `katas/NN-<slug>/` con `package.json`, `tsconfig.json`, README,
`src/types.ts`, `fakes/logger.ts`, un `scenario.ts` que falla y un test rojo,
más `interviewer/NN-<slug>.md` con la estructura del guion. Los `TODO`
marcan qué completar.

Al escribir una kata nueva:

- Partí de un incidente real. Sanitizá antes de commitear.
- El README del candidato relata el incidente sin dar la causa.
- El escenario tiene que fallar con un mensaje que apunte a dónde mirar,
  no a qué cambiar.
- Los tests rojos describen el comportamiento, no la implementación. Que
  admitan más de una solución válida.
- El guion tiene pistas escalonadas y al menos una trampa esperada.
