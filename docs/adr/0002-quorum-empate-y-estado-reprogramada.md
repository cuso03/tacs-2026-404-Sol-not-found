# ADR 0002: Quórum, empates y estado REPROGRAMADA en la votación de reprogramación

- Estado: Aceptado
- Fecha: 2026-09-14
- Alcance: Feature 6, Historia 11

## Contexto

Al cerrar una votación de reprogramación, `cerrarVotacion` comparaba el **total de
votos** con `min_participantes`. Con un mínimo de tres y votos repartidos dos a uno,
confirmaba una alternativa que había obtenido solo dos votos, contradiciendo la
consigna de la Historia 11, que exige que **una alternativa alcance quórum**.

Además, el estado de una actividad reprogramada por votación quedaba como
`CONFIRMADA`; el estado `REPROGRAMADA` existía en el modelo pero nunca se usaba.
Por último, no existía un criterio explícito para resolver empates entre
alternativas.

## Decisión

La resolución de la votación al cerrarse (manual o automáticamente) sigue estas
reglas:

1. **Quórum por alternativa.** Se cuenta cuántos votos recibió cada alternativa.
   La alternativa ganadora es la de mayor cantidad de votos, siempre que alcance
   `min_participantes` (`maxVotos >= min_participantes`). No se compara el total
   de votos emitidos.
2. **Empate cancela.** Si dos o más alternativas comparten el máximo de votos
   (con al menos un voto), no hay ganadora inequívoca; la votación se resuelve
   como fallida y la actividad pasa a `CANCELADA`. El empate prevalece aun cuando
   el máximo iguale o supere el mínimo.
3. **Estado REPROGRAMADA.** Cuando una alternativa gana con quórum, la actividad
   cambia su `fecha_horario` a la de la alternativa y su estado pasa a
   `REPROGRAMADA` (antes `CONFIRMADA`). Se notifica la reprogramación.
4. **Falta de quórum cancela.** Si no hay votos, la ganadora no alcanza el mínimo
   o hay empate, la actividad pasa a `CANCELADA`, se notifica la cancelación y se
   incrementa la métrica `Actividad_Cancelada`.
5. **Métricas.** `Actividad_Reprogramada` se incrementa únicamente cuando la
   votación se resuelve con una reprogramación exitosa; `Actividad_Cancelada` se
   incrementa cuando la votación termina en cancelación. Cada métrica refleja el
   significado de su nombre.
6. **Monitoreo climático.** `findParaMonitoreo` incluye el estado `REPROGRAMADA`
   además de `PROPUESTA` y `CONFIRMADA`, para que una actividad reprogramada
   continúe evaluándose por clima y pueda abrir una nueva votación si hiciera falta.

## Consecuencias

- Con `min_participantes` tres y votos 2-1, la alternativa ganadora (dos votos) no
  alcanza el quórum y la actividad queda `CANCELADA`.
- Las actividades reprogramadas aparecen con estado `REPROGRAMADA` y mantienen la
  fecha de la alternativa ganadora.
- Los tests existentes que esperaban `CONFIRMADA` tras una votación exitosa se
  actualizan a `REPROGRAMADA`, y se agregan casos que cubren votos repartidos,
  falta de quórum, empate y alternativa ganadora, verificando fecha y estado final
  tanto por contrato HTTP como en MongoDB.
- Las métricas de ciclo de vida se corrigen: una reprogramación exitosa incrementa
  `Actividad_Reprogramada`, una cancelación incrementa `Actividad_Cancelada`, y
  cada caso verifica que la métrica contraria no se incremente.