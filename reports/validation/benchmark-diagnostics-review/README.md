# Diagnósticos completos del benchmark

El fallo de un worker con exit 0 ya no pierde los resultados obtenidos si su JSON no se puede consumir, si divergen los hashes o si falla la generación del resumen. `benchmarks/report.cjs` posee ese ciclo; `compare.cjs` conserva metadata, presupuesto y ejecución de procesos.

## Alcance y decisiones

- Base de la corrección: `552091dd3a2236667ff40a78d983790e8778d522`, PR 33. Se mantienen el deadline configurable de 600000 ms, los cuatro procesos alternados, tres warmups y nueve muestras por proceso, las aserciones y los workloads.
- Antes de propagar el error original mediante `cause`, se guarda `complete: false`, la etapa, las muestras y comparaciones disponibles, y stdout/stderr de todos los procesos ya ejecutados. El nombre de diagnóstico incluye UUID para evitar colisiones entre fallos cercanos.
- Si tampoco se puede escribir el diagnóstico, `AggregateError` preserva tanto la causa original como el error de persistencia. No se informa éxito.
- La tabla se genera antes de publicar el JSON completo. Una excepción al formatear no deja un JSON marcado como completo.
- La frontera extraída es el ciclo del informe. `compare.cjs` pasa de 139 a 91 líneas; con el nuevo módulo son 224. Es una mejora de responsabilidades y cobertura, no una reducción de líneas totales.

## Validación ejecutada

| Comando | Runtime | Resultado |
|---|---|---|
| `node --test tests/benchmarks/*.spec.cjs` | Node 24.14.1 | 11/11 PASS, [log](node24-tests.log) |
| `node --test tests/benchmarks/*.spec.cjs` | Node 22.12.0 | 11/11 PASS, [log](node22-tests.log) |
| `git diff --check` | Git | PASS |

Los siete tests del ciclo usan datos explícitos con el contrato del worker, JSON real y archivos temporales reales: parseo inválido después de un proceso válido; divergencia después de una comparación válida; workload ausente; resumen numérico y formato fallidos; éxito; persistencia no disponible. No mockean plataforma ni inspeccionan código fuente. Los cuatro tests CLI ejecutan los motores reales, invalidan presupuestos, fuerzan un deadline de 1 ms y conservan la salida de un workload desconocido.

El job de CI ejecuta ambas suites con `tests/benchmarks/*.spec.cjs`. La suite DOM/Rust y el perfil completo no se repitieron localmente porque este cambio no modifica motor, addon, fixtures ni operaciones medidas; deben pasar en CI para el nuevo head antes del merge. No hay comando independiente de lint o typecheck para estos módulos CJS.

## Reutilización verificable del addon

Se extrajo en el clone el paquete host previamente validado `rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-13T00-07-51.835Z.tgz`, con SHA-256 `f51995807964b44509eeffb365e0d7fbbec4b1b5a9e9c3037871c03f24f055d1`. Se comprobó el digest y la ausencia de diferencias en `src`, `scripts`, `types`, `Cargo.toml`, `Cargo.lock` y `package-lock.json` entre su hito `67391a14e8057e7867f6f04fdd543bc34ae6b4c3` y el head base de la corrección. No se reconstruyó ni sobrescribió el addon del checkout original.

## Benchmark real guardado

`shadow-hosts-create-100`, 25 filas, cuatro procesos en orden jsdom/rustdom/rustdom/jsdom; 18 muestras por motor. Se reservaron CPU y E/S respecto de los demás trabajos del proyecto. Las dos ejecuciones verificaron hashes equivalentes y conservaron muestras crudas y metadata.

| Runtime | jsdom mediana | rustdom mediana | Ratio jsdom/rustdom |
|---|---:|---:|---:|
| Node 24.14.1 | 6.297 ms | 6.514 ms | 0.97x |
| Node 22.12.0 | 7.730 ms | 8.450 ms | 0.91x |

Resultados: [Node 24](../../benchmarks/2026-09-13T01-25-48.590Z-linux-x64.json), [Node 22](../../benchmarks/2026-09-13T01-27-36.490Z-linux-x64.json). Son ejecuciones de validación del runner, no evidencia de una optimización del DOM. Ambos resultados desfavorables a rustdom se conservan.

Los cuatro artefactos `*-failed.json` de 01:25/01:26 UTC corresponden a fallos esperados de los tests CLI, no a corridas completas aprobadas. La evaluación de memoria de esta corrección está en [el informe de recursos](../../memory/benchmark-diagnostics-review.md).
