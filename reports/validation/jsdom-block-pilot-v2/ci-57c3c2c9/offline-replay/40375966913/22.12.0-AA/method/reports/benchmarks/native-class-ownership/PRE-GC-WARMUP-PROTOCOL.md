# GC antes del warmup de operaciones

Variante prospectiva que corrige el orden del setup. El ensayo caliente anterior
terminó completo y rechazado: once controles jsdom fuera de ±2%. Sus crudos y
decisión se conservan en `realm-warmup-results/2026-10-22/`. No se repite ni
reinterpreta ese ensayo y tampoco la captura de optimización ya consumida.

## Cambio concreto y límites

El método anterior ejecuta tres rondas de operaciones en la ventana actual,
dos GC major asincrónicos y un GC síncrono antes del reloj. Forzar GC después
de calentar hace incierto el estado caliente del código. La captura previa
observó invalidaciones por referencias débiles, pero no las alineó con los
cronómetros: no demuestra que esto causara los rechazos.

La variante explícita `warmupGcOrder=before-warmup` conserva esos mismos dos
GC asincrónicos y uno síncrono y los mueve **antes** de las tres rondas. No
fuerza GC entre warmup y reloj. Se conservan los turnos necesarios para la
entrega de observers y las operaciones públicas medidas. El GC natural puede
ocurrir, incluso durante la medición; no se deshabilita ni se excluyen muestras.

Las fixtures temporales de observers siguen desconectándose y removiéndose;
sus asignaciones y las de Range pueden esperar al GC natural durante el
intervalo. Este efecto pertenece al nuevo método y debe considerarse al
interpretarlo. Las ventanas se cierran tras cada muestra y el GC posterior
permanece intacto. No se comparten ventanas ni se agregan caches. Los modos
frío y warmup histórico conservan su orden y sus metadatos anteriores.

Esto mide operaciones calientes, no primer uso ni tiempo completo de suites.
No es una optimización del runtime Rust, ni prueba una causa de variación,
ni acredita migración. La evidencia de arranque y los rechazos anteriores
siguen vigentes. Sin tracing, profiler, afinidades adicionales o nuevas semillas.

## Plan fijado antes de ejecutar

Reutilizar sin reconstruir la preparación oficial39720077911, artefacto12400802735,
UUID99fb5dd8-2ee8-402c-97b4-d8174069f933. Autenticar preparación y paquetes antes
y después de cada Node. El productor v2 recién corregido no reemplaza estos
inputs históricos, cuyos algoritmos Rust no cambiaron en esta variante.

Mantener Node22.12.0 y Node24.14.1, las ocho cargas, ambas fases A/A y A/B,
16 posiciones, cuatro factores independientes, una copia física por proceso
y CPU2 solo para el hilo principal. Tres warmups exteriores y nueve muestras:
256 procesos,2048 lotes,18.432 duraciones medidas. No hay piloto ni repetición
adaptativa. Ante un rechazo presupuestario completo, conservarlo y continuar
el siguiente Node; ante fallo de integridad, detener preservando lo parcial.

Estimador de medianas agrupadas y límites originales: jsdom±2%, Rust A/A±5%
y Rust A/B hasta+5%, sobre todas las filas y ambas versiones. Sin selección
de muestras, filas o semillas; sin corrección posterior del estimador. Esta
variante no concede por sí sola aceptación del PR. El gate histórico mantiene
su rechazo hasta existir evidencia válida aplicable al candidato y revisión.

## Validación y publicación previas

Ejercer las cinco copias oficiales en Node22/24: ocho cargas, hashes iguales
al oráculo histórico, activación y contadores nativos. Probar ambos órdenes de
GC, defaults fríos/CLI/Vitest/VM y rechazo de políticas inválidas antes de
asignar documentos. El nuevo verificador exige orden GC y rondas declaradas;
rechaza informes históricos relabelados, metadatos omitidos y falsos endpoints.

Conservar observaciones Window y Document por separado y baseline nativo,
heap/external/RSS post-cleanup. Tres rondas finales, últimas dos claras.
Son pruebas finitas, no ausencia absoluta de fugas ni memoria pico.

Antes de medir, publicar código, tests, evidencia y revisión sin hallazgos.
Autenticar los blobs publicados y congelar el arnés completo. Registrar commit,
hash, recibo, comandos, hardware, versiones y marcador exclusivo consumible una
sola vez. El lanzamiento debe guardar su handle y no reiniciarse por silencio.
Conservar todos los crudos y los fallos de calificación; no usar sus tiempos
funcionales para decidir presupuestos. No hay merge/tag antes de cerrar el hito.
