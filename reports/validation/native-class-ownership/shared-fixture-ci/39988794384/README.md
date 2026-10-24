# Calificación funcional remota de los fixtures compartidos

[Run 39988794384](https://github.com/guidomodarelli/rustdom/actions/runs/39988794384),
attempt 1, terminó success sobre `8c464147a4e6e523a1a7c4385d66418972174f03`.
Ambos jobs, Node 22.12.0 y 24.14.1 en Ubuntu 22.04, aprobaron cuatro tests
funcionales y cinco de evidencia con los paquetes reales. También aprobaron
la comprobación del fallo controlado: Node devolvió 1 y tee no lo ocultó.

Se autenticó el ZIP/tar de la preparación oficial sin reconstruir paquetes.
La prueba verificó el source5ef híbrido B y jsdom J0 27.4.0, las ocho cargas
con dos ciclos y sus hashes públicos originales, más validación fallida,
carga no soportada y cancelación de entrega encolada. La metadata de cada
host y preparación está completa en los artifacts originales.

## Integridad y reproducción de lectura

Los dos ZIP oficiales se guardan completos, con CRC y digest API verificados:

| Node | Job | Artifact | Bytes | SHA256 |
| --- | --- | --- | ---: | --- |
| 22 | 120534861802 | 12516188121 | 38817 | 67d63bc9da18a5ddaf00dd76bb5a7f2a0a198523883854cb4e8f4c1630211210 |
| 24 | 120534862202 | 12517565598 | 38708 | 83a75f1745d5cc70abb2903046caf64e352d36f281f21dcf566044a2285027ec |

Se contrastaron run, SHA, attempt, jobs y versiones. Cada ZIP contiene siete
archivos, incluidos todos los resultados funcionales, logs y el código/log
del control negativo. No se ejecutó ese código archivado al recolectar o
leer. `members.json` registra tamaños y hashes de cada miembro. Se conservan
también metadata REST y logs completos de ambos jobs.

Los lectores existentes de Node 22 y 24 verificaron offline todos los datos
y produjeron bytes idénticos en verified-node*.json. Comprobaron matriz,
outputs originales, preparación, baselines, rondas iniciales y dos estados
finales claros por caso. Esta lectura no vuelve a ejecutar DOM ni GC.

## Memoria y límites

Esta ejecución agregó una evidencia independiente de 76 Window y 76 Document
observadas por separado, con 59 primeras rondas no claras y 152 estados
finales requeridos claros. Las referencias a fixtures descartados y promesas
pendientes permanecieron retenidas durante los tests; aun así los targets
desaparecieron antes de salir. Los recursos nativos volvieron al baseline,
incluido napiClasses.live=22. Los reportes de memoria conservan todos los
rangos y trazas, sin convertir ese baseline en cero.

El caso negativo del pipeline provoca intencionalmente un `not ok`; el job
solo aprueba si observa correctamente su exit 1. Los tests funcionales reales
posteriores deben aprobar sin ocultar errores. Este control se distingue de
un fallo del producto y sus logs siguen disponibles.

Son pruebas funcionales y snapshots tras GC, no memoria pico ni prueba
universal de ausencia de fugas. Los 76 targets por tipo de CI y los 76 de la
calificación local son ejecuciones separadas; no se comparan sus rangos RSS
como A/B y se conservan sus primeras rondas no claras por separado.

No se midió ni aceptó rendimiento. El candidato aún espera integración en
una copia prospectiva del worker. El sampler consumido, sus muestras,
presupuestos, estimador y runtime permanecen intactos. Ownership sigue
accepted=false; esta evidencia performanceAccepted=null. Sin tag ni merge.
