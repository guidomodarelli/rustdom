# CI funcional f2 preservado

Run 40277876693, intento 1, commit
`f2a87184d7c0c439407716d1cbab05eb2965b275`: **dos jobs aprobados**.

| Plataforma | Job | Artefacto | Bytes | SHA256 |
|---|---:|---:|---:|---|
| Windows | 121424413010 | 12630783458 | 1069 | cb0937f25001c8bf088fa97ef9fa5e2a76e17219dcd9c9038073e94574a86685 |
| Ubuntu | 121424413255 | 12630862955 | 9849 | 4f05fe0845f1634901f0c2c566b3a2edaf7606b2fd9364e17e584255ed187b4b |

Se conservan ZIP originales, metadata API, logs de jobs, todos los miembros,
snapshots parciales y terminales, y recibos de transporte. El lector mantenido
`../tools/verify.py` usa pins independientes junto a su código; no confía en el
`policy.json` del directorio inspeccionado. Seis contratos Windows/Linux pasan,
incluido el rechazo de un reseñado coherente de datos y su policy de entrada.
No importa ni ejecuta código de los ZIP. Los CR/CR/LF originales Windows se
conservan; el parseo no reescribe los bytes.

Cada job pasó siete contratos de Git y cinco de transporte; Windows omite dos
casos de extracción Linux. Ubuntu pasó además doce de ensamblado y seis ciclos
por SDK Node 22.12.0/24.14.1, con doce endpoints finales claros separados.
Tar fb06276a y ELF a277 se autentican antes del runtime. Los datos de recursos
se conservan también en `reports/memory/numeric-package-ci/hosted/40277876693/`.

Este productor es **anterior al fix del índice canónico**. El lector registra
`producerCanonicalIndexSealPresent=false`; no presenta estos doce contratos
como prueba de la regresión posterior de trece. El CI pasó con los datos reales
originales, pero su cobertura no incluía esa alteración de procedencia.

Esto no acepta rendimiento, no reevalúa ownership ni habilita tag/merge. No hubo
captura científica nueva. Los snapshots finitos no prueban memoria pico ni
ausencia universal de fugas; el runtime sigue híbrido.
