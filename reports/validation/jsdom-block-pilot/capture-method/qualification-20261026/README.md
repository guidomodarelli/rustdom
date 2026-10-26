# Calificación del capturador, sin activación científica

El CI del checkout archivado sobre `6a8f541c` terminó aprobado en ambos SDK:
run **40320141130**, intento 1. Se preservan API, ZIP, logs e inventario
autenticado en `hosted-checkout-40320141130/`. Cada job reprodujo 80 procesos
históricos y aprobó 15 contratos sin capturas nuevas. El CI general del mismo
SHA también aprobó. Ownership conserva el rechazo de rendimiento.

El método prospectivo separa coordinación, bindings, ejecución, supervisor,
archivo y replay. Reutiliza las tareas históricas sin modificar los 786 pins.
El nuevo adaptador de lectura conserva la diferencia real entre `stat.dev`
y `fstat.dev` en Windows; compara inodos y descriptores reabiertos, mantiene
límites y cierra los handles incluso ante errores. No normaliza observaciones.

La calificación funcional se ejecutó desde el Git Linux real y limpio
`5bd2e200019b54f9b333cec5c6b7b5e0de85ce41`, fixture privado, **no publicado**.
Node 22.12.0 y 24.14.1 ejecutaron 128 workers del coordinador, 32 positivos
del padre anterior y 12 adversos. Cuatro casos reales de cancelación del
controller o muerte forzada de Node conservaron parciales y terminaron sin
descendientes propios. Pasaron 60 contratos Node por SDK tanto en Linux como
en Windows, además de 10 contratos Python por plataforma. Las pruebas de
integridad adicionales del paquete aprobaron en ambos SDK Linux.

Los cuatro archivos de criterios preservan 18 432 duraciones medidas,
6 144 warmup, 1 536 Window y 1 536 Document separados; no se combinan con
épocas anteriores ni se usan para inferencia estadística. El archivo
`legacy-lifecycle-raw.tar.gz` conserva los controles anteriores, fallos y
parciales. Las cuatro cancelaciones terminaron con exit 2, como se esperaba.
Sus journals y los doce snapshots de padres completos están en
`reports/memory/jsdom-block-pilot/capture-method/20261026/`. Los snapshots no
miden memoria pico ni demuestran ausencia universal de fugas.

Los hashes y el código exacto calificado, conservado como datos, están en
`qualified-source-map.json` y `qualified-source-as-data/`. Los fixes posteriores
de ambos workflows corrigen la extracción por ID con `merge-multiple: true`;
el CI funcional ejerce esa misma ruta y conserva la respuesta API. El fixture
5bd2 no califica esos bytes posteriores. Actionlint y revisión aislada final
aprobaron los YAML, con cero hallazgos abiertos. El CI del nuevo SHA debe
confirmar la integración antes de habilitar la captura.

`executionReady=false`, `completeMethodReview=false` y la publicación PREVIEW
impiden activar el método. No se aplicó etiqueta, no se repitieron estudios
consumidos, no se cambió ningún presupuesto y no se creó tag ni merge.
`performanceAccepted=null`, `gateReevaluated=false`; runtime híbrido.
