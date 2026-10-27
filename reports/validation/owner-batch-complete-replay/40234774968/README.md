# Verificación offline del estudio completo

Los lectores actuales en Node 22.12.0 y 24.14.1 verificaron el run 40234774968,
intento 1, método `504ebc36b66dd6f36b19fd67bd6d61b3faff3f67`. Ambos produjeron
la misma comparación íntegra y siete archivos de tablas byte a byte idénticos.
Se autenticó la captura completa, pero el rendimiento fue rechazado: cumplen
42/64 criterios. El exit code 1 de ambos lectores corresponde a ese rechazo.

Los ZIP, tar originales, API, logs y manifiestos están en
`reports/benchmarks/native-class-ownership/owner-batch-study-results/40234774968/transport/`.
Las dos decisiones originales conservan los paths e identidades reales del lector:
Git Linux nativo `f781` con WIP real, sin presentarlo como checkout publicado limpio.
No se ejecutaron scripts archivados ni se repitieron mediciones DOM.

Cada `*-derived.tar.xz` preserva todos los metadatos, logs, decisiones, partes,
manifiestos y tablas de una ejecución de lectura. Las copias extraídas de payload
y tar no se duplican allí: el recibo `*-preservation.json` enumera TODOS los
miembros originales, con hashes y referencias a los tar íntegros conservados.
Se verificaron 9748 archivos de payload por lector antes de retirar únicamente
sus copias temporales. Las muestras originales no fueron eliminadas.

Los archivos de QA anteriores conservan resultados funcionales y adversariales,
incluidos errores iniciales y fixes de cancelación, bytecode obsoleto y publicación
atómica. Sus flags pendientes describen el estado histórico de esas pruebas;
la decisión científica final está en las dos decisiones del resultado completo.
Los paquetes de contenido direccionado incluyen índices para recuperar cada path
original sin duplicar bytes idénticos. El código contenido en esos archivos sirve
solo como auditoría: ejecutar exclusivamente los lectores actuales del checkout.

`publish-owner-batch-results-analysis.py.txt` es el código exacto que contrastó
todos los granos, duraciones, bloques, endpoints y deltas para construir los
reportes. Se conserva como evidencia de la ejecución, con sus paths originales;
no es un comando portátil. `receipt.json` identifica el código actual del lector.
Las instrucciones de replay están en `owner-batch-exports/README.md`.

Esta publicación no acepta el rendimiento, no integra el candidato y no justifica
tag ni merge. Los dos gates de ownership siguen rechazando el estudio histórico.
La migración general a Rust permanece activa e incompleta.
