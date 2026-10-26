# CI de dispersión: dos jobs aprobados

Run40288143186, intento1, head `5be2eebcd3b13bac03ce595eb8f5bc06758e2ccf`:
Node22.12.0 y24.14.1 terminaron aprobados. Cada job ejerció **once contratos
escalares y seis de lectura**, anteriores al lector de procesos agregado después.
No son los 19 contratos nuevos ni una captura DOM.

| Node | Job | Artefacto | Bytes | SHA256 ZIP |
|---|---:|---:|---:|---|
| 22.12.0 | 121456599071 | 12635132557 | 162621 | 99e876210d130be594b7919a547129cb6369a2fe7ae94660dc18e548805d711d |
| 24.14.1 | 121456599383 | 12635208664 | 162503 | a8e295404cf51abfd00bd952e398d5416dd65bd37c64050adf8dde8d86a206e2 |

ZIP/API/jobs/logs/manifiestos completos conservados. Los dos calendarios
propuestos siguen siendo idénticos a SHA6e6c0daf; no hubo procesos DOM medidos.
El lector actual permite únicamente IDs numéricos ASCII registrados junto al
código. Mantiene separados ec57 (seis contratos, siete miembros) y 5be
(once escalares, seis lectores, once miembros). Nueve contratos del lector
pasaron Windows/Linux; un archivo o policy aportado por el input no reemplaza
los pins de código. No se ejecutan miembros archivados.

```sh
python -B reports/validation/jsdom-block-pilot/hosted/tools/verify.py reports/validation/jsdom-block-pilot/hosted/40288143186 40288143186
```

El recibo de transporte conserva su estado histórico publicationOfHostedArchivePending=true;
el manifiesto de esta publicación acredita el paso posterior. performanceAccepted=null,
gateReevaluated=false; ownership sigue rechazado por rendimiento y sin tag/merge.
