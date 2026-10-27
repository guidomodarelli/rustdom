# Preparación actual y contratos históricos separados

El CI de 5caa3ea9 detectó dos contratos ligados al candidato anterior:

- XML construyó los paquetes actuales y aprobó las pruebas públicas de ambos
  SDK, pero exigió el hash del candidato fijo de `xml-full-inputs-v1` para
  inspeccionar la preparación nueva. El artifact 12719061087 del run
  40471170072 se autenticó por ID, run, SHA, tamaño y digest. Aquí se conservan
  el ZIP íntegro, tar, metadata, logs originales y pruebas del lector actual.
- Los fixtures compartidos cargaban el paquete consumido 39906777389 y
  contrastaban HEAD con sus fuentes antiguas. El workflow ahora identifica su
  calificación como histórica y usa Git limpio 4196c496. `head` registra ese
  SHA real; `eventHead` conserva el SHA del PR que disparó la verificación.

`inspect-xml-preparation.cjs --inspect` comprueba fuentes/build, distribuciones
completas, dependencias, compilador, SDK y glibc contra la preparación real.
Comparte la inspección con el contrato anterior para evitar duplicar lógica.
Su resultado es `preparation-only`: no admite ejecución, salida de captura ni
elegibilidad científica. El CLI histórico `xml-current-run.cjs --inspect/--run`
conserva el hash fijo del candidato y rechaza la fuente nueva. Los tests
comprueban ambas conductas y las alteraciones reales de código, build, dist
y dependencia; un rechazo de alcance no puede ocultar esas alteraciones.

En Node 22.12.0 y 24.14.1 pasaron once tests XML, cuatro de fixtures reales
jsdom/Rustdom y cinco de evidencia por SDK. Los tres tests adicionales del
lector de recursos combinados están documentados en
`reports/validation/combined-resource-checkout/20261027/`.
Actionlint verificó los dos workflows cambiados. No se repitió ni activó una
captura científica ni se reconstruyeron paquetes consumidos.

Se conservan la primera calificación XML de diez tests y la final de once,
además de un preflight de staging fallido antes de cargar runtimes. El filtro
de tar de Python 3.10 rechazó un symlink relativo válido; la extracción de
datos posterior comprobó paths, tipos, duplicados y destinos, escribió primero
archivos/directorios y creó solo al final los seis links internos verificados.
No se ejecutó código archivado; el lector usa las fuentes actuales del repo.

La revisión detectó que el primer recolector escribió el recibo del proceso
encima de `functional.json`; los endpoints de esos dos intentos se perdieron.
Sus recibos y logs originales se conservan, sin reconstruir observaciones.
Se corrigió el recolector para usar `functional.process.json` y se repitieron
solo los cuatro tests funcionales por SDK. Los nuevos reportes conservan
38 casos por SDK, con recursos completos y hashes comprobados después de
escribir el recibo separado. No se repitió un estudio científico.

Esos endpoints están en `shared/node*-resource-preservation/functional.json` y en
`reports/memory/current-preparation-decoupling/20261027/`. El inspector nuevo
solo conserva metadata local durante cada invocación, sin caches mutables ni
referencias DOM globales. No se afirma memoria pico ni ausencia universal de
fugas. Los benchmarks adversos del runtime integrado siguen publicados en
`reports/benchmarks/range-native-production/20261027/`.

El gate ownership actual conserva su rechazo: las fuentes ya no coinciden con
39921160254 y esa captura además rechazó sus presupuestos. Estos arreglos de
contratos no cambian esa decisión ni cierran el PR. `performanceAccepted=null`,
`gateReevaluated=false`; falta la confirmación científica íntegra del candidato.
