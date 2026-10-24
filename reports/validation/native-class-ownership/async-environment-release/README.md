# Liberación de entornos asíncronos

Seis tests aprobaron por Node 22.12.0 y 24.14.1 con addon real y jsdom 27.4.0.
Las ocho cargas originales conservan tres rondas, incluyendo el runtime de referencia
checkpoint67. Solo Vitest y VM usan el default existente de 12 rondas/10 s.
Todos los escenarios exigen dos endpoints consecutivos con Window/Document en cero
y los contadores nativos en su baseline exacto; el helper y el sampler no cambiaron.

Se conservan 56 endpoints aprobados, observando 672 Window y 672 Document distintos,
incluidos warmups. Los tests del endpoint también ejercieron seis ciclos por motor
y Node: retener deliberadamente un Document impidió aceptar; soltarlo permitió
comprobar cero Document, Window y elementos, con recursos nativos liberados.
Las pruebas no demuestran ausencia universal de fugas ni observan memoria pico.

El log original de CI 39686199408/shard1 y su traza siguen conservados: las rondas
fueron false/false/true, con ambos objetivos ya recolectados en la tercera ronda,
pero sin una segunda observación limpia disponible. original-ci-trace.json es el
diagnóstico anterior a la validación y conserva su campo validated=false original;
validation.json y los logs nuevos acreditan la validación posterior.

No son muestras para aceptar rendimiento y no suman APIs DOM migradas.
