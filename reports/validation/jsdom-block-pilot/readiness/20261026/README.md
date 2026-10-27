# Calificación del perfil de habilitación, sin captura

Esta evidencia corresponde a perfiles privados de Git Linux. No habilita por
sí sola la secuencia, no representa commits publicados y no acepta rendimiento.
El candidato todavía debe completar la calificación hosted indicada abajo.

En `incomplete-review/`, el Git limpio **7bd4c9a4** activa los flags del perfil
pero conserva `completeMethodReview=false`. Ambos SDK fijados aprobaron
51 contratos. Los checks adicionales cotejan el catálogo completo de 849
dependencias, su digest, los 850 archivos de la publicación y la identidad
real de Git antes de exigir el rechazo concreto por revisión incompleta.

En `reviewed-admission/`, el Git limpio **4ce60ce2** incorpora la revisión
local real sin hallazgos del método y de la transición. Ambos SDK admitieron
la fuente revisada y rechazaron la construcción de la expectativa científica
por falta del recibo del controller. No se inventó una identidad de GitHub,
no se consultó su API desde esa admisión y no se inició captura de DOM.

El snapshot conserva los 850 miembros del perfil y el recibo original como
datos. Su archivo íntegro tiene **12 477 959 bytes**, SHA256
`a4b2507a84528ef22a8db46897809af22642aeafe712ea8353af27917e87f08e`;
el lector verificó 829 archivos físicos y 33 106 931 bytes sin ejecutar código
archivado. Los miembros restantes son referencias publicadas autenticadas.
Comandos, logs, commit y árbol reales se conservan por perfil.

`candidate-at-preparation/` conserva los cuatro archivos propuestos. Su recibo
separa las calificaciones 5bd2, 7c29, 7bd4 y 4ce para no atribuir contratos de
un perfil a otro. `hostedQualificationCompleteAtReviewTime=false` describe
el momento de revisión. La admisión real exige posteriormente los cuatro
jobs de calificación/transporte y ocho generales del SHA publicado final,
comprobados por `capture/once.cjs`, antes de aplicar la etiqueta una sola vez.
La revisión del candidato cerró sin hallazgos; no equivale a CI aprobado.

## Transporte conservando los bytes originales

`git-byte-storage/receipt.json` documenta una prueba con un ZIP real autenticado
de 21 256 521 bytes. Se dividió en seis partes en un repositorio Git aislado,
se publicaron en un remoto bare local y se recuperó el ZIP con su SHA256
original exacto. No hubo publicación en GitHub durante esta prueba.

La prueba también rechazó retirar bytes modificados sin commit y retirar
copias antes de publicar el commit. Tras verificar publicación, índice y bytes,
solo se retiraron las copias de trabajo propias de las partes, conservadas
íntegras en Git; la recuperación se hizo leyendo esos blobs. No se retiraron
datos ajenos ni se recomprimió o reinterpretó el ZIP/TAR original.

Esto permite preparar una colección por partes con memoria acotada y sin
mantener todas las copias extraídas simultáneamente. No garantiza espacio
para cualquier tamaño posible: la colección debe comprobar capacidad y
preservar parciales si alcanza un límite. La prueba no certifica la calidad
estadística de datos ni el rendimiento del DOM.

El primer intento de preparación falló por un rename entre filesystems;
`preparation-transport-error.json` registra el error sin atribuirle muestras.
Se usó una copia verificada para preparar el perfil nuevo. No se repitió
ningún estudio consumido. `performanceAccepted=null`, `gateReevaluated=false`;
runtime híbrido, sin tag ni merge de ownership.
