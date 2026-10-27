# Instrumentación validada, captura diagnóstica pendiente

El resultado de aceptación sigue siendo el ensayo completo 39735778846:
`verified=true, accepted=false`. Seis controles no calibran; no se cambian
presupuestos, estimador ni muestras. No hubo nueva migración de APIs.

La lectura de todas las series muestra que la aceleración durante las muestras
de `range-control-1000/1000` en Node 22 aparece tanto en A/A rechazado como en
A/B calibrado. No explica por sí sola la decisión. El
[protocolo prospectivo](../sampler-diagnostics/PROTOCOL.md) define una captura
acotada de warmups, intervalos, GC y perfiles, sin decisión de aceptación.

Los contratos locales ejercieron cuatro procesos reales, 32 cargas y 384 spans.
Se conservan todos los eventos GC observados en `summary.json` y en los crudos.
Son validación funcional de instrumentación con overhead;
sus duraciones no sirven para afirmar mejoras ni resolver regresiones.
La captura con CPU profiler todavía no se ejecutó.

El host local es WSL2, Intel i7-1360P y 16 CPUs visibles; el estudio rechazado
usó un runner Azure EPYC con cuatro vCPU. Las futuras trazas locales pueden
describir mecanismos del sampler, pero no identificar por sí solas la causa
del drift en ese runner ni demostrar que una regresión allí quedó resuelta.

Fuentes completas, comandos y crudos están en
`reports/validation/native-class-ownership/sampler-diagnostics-method/`.
La memoria se describe por separado en
`reports/memory/native-class-ownership/sampler-diagnostics-method.md`.
