# Control de Node 24 en CI

Se declara tras completar la medición local, antes de ejecutar en el runner.
En WSL, Node 22 calibró y pasó A/B en las trece filas (máximo +2,522%). Node 24
no calibró en `xml-serialize/1` (+2,836%) y getter-error/1 (+2,692%); no hubo A/B.
Los resultados locales permanecen publicados, incluidos sus fallos y límites.

La hipótesis siguiente es ambiental: medir el mismo protocolo en un runner Linux
limpio permite observar si persiste la variación entre procesos sin el host
Windows/WSL. No identifica por sí solo una causa ni reemplaza los datos locales.
No se desactiva JIT, turbo ni GC y no se modifica la política de energía.

El job usa Ubuntu 22.04, Node 24.14.1, Rust 1.99.1 y la primera CPU permitida por
el cpuset del runner, registrada en el informe. Construye checkpoint 66 y el
candidato antes de medir, con lockfiles y compiler iguales; no ejecuta builds,
tests ni otras mediciones simultáneas dentro de ese runner. Otros jobs usan sus
propios runners. Se registran hardware, fuente, SHA solicitado y ambos binarios.

Conserva las trece filas, warmup 256/16 según tamaño, dieciséis procesos por fila,
256 muestras por etiqueta y gates ±2%/+5%. A/B y referencia solo se habilitan si
calibran todas las filas. Si falla A/A o A/B, el job falla y conserva las muestras;
no se reintenta para seleccionar un resultado favorable. La aceptación, si se
obtiene, se limita a ese host y protocolo y no certifica todas las máquinas.

El ejecutor portable exige un directorio de salida nuevo y verifica el caso de
historial existente con el CLI real. Los artefactos del job deben descargarse,
verificarse y guardarse en el repositorio antes del checkpoint. El PR sigue
pendiente hasta completar este control, CI general y review del SHA final.
