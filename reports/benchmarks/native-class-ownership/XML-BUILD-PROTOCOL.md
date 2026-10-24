# Preparación completa de baseline XML y candidato

Esta preparación produce evidencia de construcción y comportamiento, sin muestras
de benchmark ni aceptación de rendimiento. No modifica el gate XML histórico ni reutiliza su
resultado positivo como aprobación de un build nuevo. Ambos históricos actuales,
incluido el rechazo de calibración posterior, conservan su estado y sus límites.

Se fija checkpoint-066-reference-catalog como referencia, con identidad canónica
993a1efdbd928991028f8831c62ef65fe4612b1797727afda3870c5058a87415 y sus ocho inputs
de raíz declarados en la política XML existente. El candidato se captura tal como
está antes y después; no se interpreta como evidencia de timing válida por usar
una fuente parecida. La política histórica de ownership conserva checkpoint067.

Se reutiliza el productor real, sin cambiar sus herramientas, comandos, contratos
de recursos o reglas de snapshots. Solo cambian la revisión de la receta, sus
archivos adicionales de procedencia y el callback de captura de referencia. Se
conservan fuentes canónicas, inputs opcionales presentes y ausentes, dependencias,
symlinks, versiones, binarios, distribuciones, stdout/stderr y fallos parciales.
La preparación debe poder verificarse después de trasladarla, sin recompilar.

GitHub construye con Node24.14.1, npm11.11.0 y Rust1.99.1 sobre Ubuntu22.04. Cinco
copias físicas A0/A1/B/J0/J1 conservan aislamiento de módulos y native allocations.
En Node22.12.0 y24.14.1 se ejercitan tres ciclos por copia y se observan Window y
Document por separado, con el mismo límite64rondas/10segundos y dos endpoints
claros. Son probes finitos; no certifican ausencia universal de fugas ni memoria pico.
Las suites XML públicas y nativas usan el addon y el jsdom independiente reales.

Los contratos ejercen snapshots reales, rechazo de baseline incorrecto, cambios
canónicos y de build.rs, configuración npm no declarada, captura de candidato
nuevo, separación del lector checkpoint067, ambos informes de memoria y el CLI
real. El workflow de ownership ya existente vuelve a probar la política por
defecto y sus archivos históricos. No se agregan mocks o tests de strings fuente.

Durante el estudio local original de afinidad no se ejecutan suites o compilaciones
locales ni se editan sus422fuentes medidas. Los archivos nuevos y la extracción de
la factory están fuera de ese grafo. La validación se ejecuta en GitHub en otro
host. No se lanza un benchmark XML aquí. Cualquier método futuro deberá declararse,
calificarse, revisarse, publicarse y autenticarse antes de una única secuencia.
Esta preparación no añade Rust, no cierra fase ni habilita tag o merge.
