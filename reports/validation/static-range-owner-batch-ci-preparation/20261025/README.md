# Preparación de CI: fuentes shallow y errores Git

El run 40204293701 del SHA c331cc84 falló en las dos versiones Node de macOS y
Windows durante el primer `git clone --shared` de las fixtures, código 128, antes
de construir o ejecutar DOM. El test original capturó stderr pero no lo guardó:
la causa Git interna queda desconocida. No se presenta como diagnosticada por el
solo hecho de que la fuente de Actions sea shallow.

Se autenticaron y conservaron completos sus cuatro artifacts por ID, run, fuente,
nombre, tamaño y digest SHA256. artifacts.api.json, jobs.api.json y macos24-job.log
conservan la observación y los logs originales; el run todavía tenía Linux en cola
en ese snapshot. No ejecutar programas archivados.

La corrección crea fixtures Git con índices y refs propios, objetos compartidos
por alternates y la frontera shallow original. Evita un transporte innecesario;
no cambia HEAD, fuentes ni los diez hashes del candidato. Cada comando Git guarda
sus logs antes de propagar fallos o timeouts. El wrapper reutiliza el ejecutor
actual autenticado por SHA, con limpieza del grupo de procesos ante timeout.

En Windows y Linux pasaron nueve contratos reales por plataforma: cuatro sobre
la fuente original, cuatro sobre una fixture shallow explícita y la conservación
del error Git con frontera inválida, sin mocks. Se comprobaron las fuentes
resultantes, consumidores copiados, rechazo de fuente sucia/salida existente y
configuración alterada, y preservación de los datos ajenos de cada fixture.
local-contracts.zip conserva 620 miembros de QA inicial y final; summary.json
incluye su manifiesto completo y los hashes exactos del código ejecutado.
El workflow actualizado pasó actionlint. La nueva matriz CI remota está pendiente.

No cambió código de runtime y no se repitieron suites DOM ni benchmarks: su QA
local de Node 22/24 sigue publicada en el hito c331cc84. Esta evidencia de transporte
no acepta rendimiento, no reevalúa el gate y no habilita tag/merge de ownership.
Los fixtures y procesos son acotados; no se mide memoria pico ni se afirma ausencia
universal de fugas. El objetivo general continúa activo y el runtime híbrido.
