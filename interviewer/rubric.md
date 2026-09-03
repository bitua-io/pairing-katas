# Rúbrica común

Se aplica a todas las katas. Cada guion agrega criterios propios.

Puntuación por dimensión: **1** (no aparece) · **2** (aparece con ayuda) ·
**3** (aparece solo) · **4** (aparece y además enseña algo al entrevistador).

No sumar. Mirar el perfil. Un junior con 3 en "pregunta antes de codear" y 2
en "código" es mejor señal que al revés.

## Dimensiones

### Diagnóstico
Lee el log, el escenario y el código antes de proponer. Formula una hipótesis
verificable y la verifica. Distingue causa de síntoma. No arregla lo primero
que ve.

### Lectura de código ajeno
Abre los tipos y los fakes. Lee comentarios. Cuando algo lo sorprende, va a
la fuente en vez de asumir. Nombra la duplicación cuando la ve.

### Diseño antes de código
Explica qué va a cambiar y por qué antes de escribir. Nombra al menos una
alternativa y el trade-off. Acepta cambiar de idea con un argumento.

### Comunicación
Piensa en voz alta. Pregunta cuando el enunciado es ambiguo. Dice "no sé"
cuando no sabe. Explica el código que escribe sin que se lo pidan.

### Código
Corre los tests seguido. Lee los mensajes de error. Hace cambios chicos y
verifica. No rompe lo que estaba verde. Tipos coherentes con el cambio.

### Pensamiento de producción
Piensa en qué pasa con datos reales (volumen, latencia, reintentos). Nombra
qué log o métrica querría. Sabe dividir el cambio para mergear con seguridad.

## Señales de alerta

- Cambia código sin haber reproducido el problema.
- Comenta o borra un test que falla en vez de entenderlo.
- No hace ninguna pregunta en toda la sesión.
- Ignora el fake y dice "en la vida real esto no pasa" sin verificar.
- Se frustra con el entrevistador cuando una pista contradice su hipótesis.

## Señales muy buenas

- Pide correr algo antes de opinar.
- Encuentra algo en el código que el guion no menciona y lo nombra sin
  desviarse del objetivo.
- Se da cuenta de que su primer arreglo no cubre un test y lo dice antes de
  correrlo.
- Al cerrar, resume qué hizo, qué dejó afuera y qué haría después.

## Después de la sesión

Escribí el feedback en las 2 horas siguientes, con este formato:

```
Kata: NN-slug · Nivel: junior/senior · Duración real: NN min
Diagnóstico: N · Lectura: N · Diseño: N · Comunicación: N · Código: N · Producción: N
Hasta dónde llegó: (fase y test)
Pistas usadas: (cuáles y cuándo)
Lo mejor:
Lo que me preocupa:
Recomendación: avanzar / no avanzar / otra ronda con foco en X
```
