# Variante GC antes del warmup: calificación funcional

El sampler histórico calienta operaciones y luego fuerza GC. Esta variante
mueve esas mismas dos colecciones major asincrónicas y una síncrona antes
de las tres rondas, y no fuerza GC entre warmup y reloj. Los defaults frío
y caliente anterior conservan sus rutas y metadatos. El GC natural puede
ocurrir durante el intervalo; las asignaciones temporales del warmup pueden
seguir pendientes hasta entonces. No es una optimización del DOM ni una
causa demostrada de los controles rechazados.

El código y protocolo prospectivo están en `PRE-GC-WARMUP-PROTOCOL.md` y los
archivos `pre-gc-warmup-*`. La preparación oficial v1 y sus cinco copias
permanecen fijadas. No se construyeron addons ni se repitió la captura de
optimización o el ensayo anterior. La nueva secuencia completa requiere
publicar, autenticar y congelar este método antes de comenzar.

Calificación desde `/tmp/rustdom-pre-gc-method-exroua90`, terminal exit0:

| Validación real | Node 22.12.0 | Node 24.14.1 |
| --- | ---: | ---: |
| Contratos del worker, cinco paquetes y lector histórico | 9/9 | 9/9 |
| Ocho cargas con ambos órdenes de GC, errores y recursos | 4/4 | 4/4 |
| Defaults, CLI original, Vitest normal y VM | 6/6 | 6/6 |
| Window/Document, baseline nativo y retención deliberada | 4/4 | 4/4 |
| Total | **23/23** | **23/23** |

Por Node se guardan 40 lotes de los cinco workers y 32 lotes directos de ambos
órdenes: 648 duraciones funcionales por versión. No se usan para presupuestos.
Los workers registran 480 Window y 480 Document por Node, usando el último
contador acumulado de cada proceso. Los 32 lotes directos comprueban doce
referencias por tipo/lote. Las últimas dos observaciones de cada endpoint
quedan claras y los recursos nativos regresan a baseline. Se conservan hashes
públicos y contadores de activación; el orden GC omitido o los falsos endpoints
son rechazados por el lector. El estudio anterior permanece verificado y
rechazado y no puede relabelarse con el método nuevo.

Se congelaron y autentican 403 fuentes del método. Los 391 archivos sin cambios
coinciden con sus blobs Git; los doce editados están en LF y serán contrastados
al publicar. `harness.json` registra todos los bytes y el hash completo
`8798e3f0420e7bf78fe6dc9051bc4bda787fe2ccf047cc5a12a97b9381ad3543`.
Tres inputs adicionales de calificación —dos tests de defaults y su oráculo
JSON— están en `test-fixtures.json`, fuera del grafo ejecutable del benchmark.

`qualification.tar.gz` conserva 491 miembros: fuentes, informes, logs,
comandos, soporte de tests y wrappers de publicación/lanzamiento. Su lectura
completa se contrastó por bytes/SHA con los originales. Los dos fallos de
preparación inicial están conservados: faltaban el oráculo y los tests de
defaults en la copia. Se incorporaron como inputs autenticados; los comandos
que ya habían pasado no se repitieron. No se ocultaron fallos del producto.

El CLI usa dependencias reales mediante el enlace documentado en
`test-environment.json`. Los 569 archivos de distribución de B coinciden con
el paquete oficial y los 3.530 archivos esperados de dependencias restantes
también; dentro de ese conjunto esperado difiere `.package-lock.json` de
instalación, preservado en el tar. La fixture añade 9.979 archivos de herramientas
Jest/Vitest; el inventario completo de 13.510 archivos y sus hashes está en el
tar. No se afirma equivalencia entre árboles completos de dependencias.
Se incluyen los ocho archivos adicionales de `src` usados por la
fixture real de Vitest/VM. El tar de calificación omite el enlace absoluto a
node_modules: para reproducir requiere reconstruir esa fixture con la
preparación oficial ya versionada. No es un archivo autónomo de dependencias.

Un helper Node de comparación del árbol completo fue terminado por el sistema
sin alcanzar un resultado. La causa no quedó probada. Se sustituyó por una
comparación por bloques con salida acotada, que registró el lock de instalación
distinto y las herramientas adicionales. El fallo y su alcance están en `helper-failure.json`;
no es una prueba de fugas de rustdom. Ninguna medición de aceptación estuvo
activa durante la calificación o ese helper.

Memoria y límites en `reports/memory/native-class-ownership/pre-gc-warmup-method.json`:
rangos agregados de heap/external/RSS después de cleanup, mezclando cargas,
motores y ambos órdenes. No son comparaciones de memoria, pendientes de
retención ni memoria pico. Endpoints finitos no prueban ausencia absoluta de
fugas. Este avance no suma implementación Rust ni acepta rendimiento; el
gate del PR80 sigue rechazado y el hito continúa sin merge/tag.
