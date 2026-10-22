# Gate de la evidencia C

El workflow de ownership todavía esperaba la fuente B `83322767…` y rechazaba
C `0d67e1d8…` antes de construir. Ahora verifica el estudio C publicado en
`paired-inline/2026-10-22`, con las fuentes reales de checkpoint067 y del candidato.
El resultado esperado sigue siendo **exit 1, verified=true, accepted=false**.
No se acepta el presupuesto, no se crean mediciones ni se elige otro histórico.

El gate autentica el manifest fijado y sus 931 archivos, comprueba el código
canónico, los 357 archivos del arnés y los inputs raíz/presencias declaradas.
Reutiliza el verificador original: 64 procesos, 9.216 duraciones, ocho filas,
ambos Node y los umbrales originales. Datos incompletos, alterados o fuentes
distintas terminan con exit 2. Conserva los seis specs anteriores del workflow.

Los 14 contratos nuevos pasaron en Linux Node 22.12.0/24.14.1 y Windows
Node 24.14.1, sin exclusiones. Los logs, comandos y hashes de código se guardan
aquí. Los CLI Linux verificaron el checkout actual contra blobs Git reales de
checkpoint067: ambos devolvieron el resultado negativo esperado.
El comando completo del workflow, con los seis specs anteriores y el nuevo,
también aprobó sus 43 contratos en cada Linux Node 22/24, sin exclusiones.

El primer CLI usó una copia recortada de la referencia que no contiene build.rs.
Su rechazo exit 2 está conservado en `incomplete-reference-cli.*`. Después se
restauraron los blobs originales completos del alcance e inputs raíz mediante
git archive; no se modificó la referencia congelada ni se ejecutaron cargas.

El replay es offline y no demuestra tiempos de un binario recién compilado
en este host de CI. Hardware, herramientas, fuentes y distribuciones del estudio
original siguen en su archivo. No suma APIs migradas ni habilita merge/tag.

Revisión local de código: `/root/review_name_queries`, solo lectura,
0 hallazgos accionables. actionlint y git diff --check aprobados.
