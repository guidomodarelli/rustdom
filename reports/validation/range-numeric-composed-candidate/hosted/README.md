# Calificación hosted del candidato numérico compuesto

El run [40263224006](https://github.com/guidomodarelli/rustdom/actions/runs/40263224006),
intento 1, commit `e6c4e6a9e376c5f13474087550f96668ac0d476d`, terminó
**6/6 jobs aprobados**: Node 22.12.0/24.14.1 en Ubuntu 22.04, Windows y macOS.
Esto confirma el fix del preflight promisor/shallow publicado en ese commit.
No acepta rendimiento ni integra el candidato en producción.

El CI general `Validate rustdom`, run40263224090 del mismo commit, también
terminó aprobado; su API y jobs están conservados. Ambos checks ownership
terminaron rechazados por el presupuesto de rendimiento, con logs íntegros.

Cada job aprobó 18 comandos y un probe adicional: 313 tests Rust, formato,
Clippy, addon real, contratos públicos, consumidor TypeScript ejecutado,
compatibilidad, Jest, Vitest, VM, corpus, WPT y dos probes de memoria.
El corpus tiene 1784 casos compatibles y ocho exclusiones script-on.
WPT conserva 240 fixtures, 83007 aserciones, 81804 aprobadas y 1203 resultados
adversos compartidos con jsdom 27.4.0 por job. Mantiene `complete=false`, la
exclusión de layout/test_driver y el bloqueo de range-deletion del bootstrap
de referencia; no es una certificación completa de estándares.

## Procedencia y archivo íntegro

`40263224006/` conserva seis ZIP originales, metadata API, respuestas completas
de jobs, logs, manifiestos de los 4840 miembros de cada ZIP y lecturas offline.
`collection.json` registra la matriz y el artefacto Linux seleccionado.
Los scripts de transporte `.py.txt` se guardan solo como evidencia; no ejecutarlos.
Las observaciones intermedias y el fallo local de parseo UTC de Python 3.10
también permanecen conservados.

La política actual en `tools/constants/qualification.json` fija por separado
ID, nombre, tamaño y digest de cada artefacto, además del ID y digest de su job
terminal. El lector exige commit, intento, éxito, plataforma/SDK y fechas
compatibles. No basta con reescribir el ZIP y sus ledgers de forma coherente.
La regresión de ese caso cerró el P2 detectado en revisión antes de publicar.

La fuente compiladora tiene HEAD real `f781c3b7` y el patch compuesto
`47c6f7c54a6cbab05bdeca7f911c3eb4f76684912a03553dfe7a5839fa8f076f`.
El qualifier comprueba los 344 inputs antes y después de las suites. Cada ZIP
contiene 167 de esos inputs, que el lector vuelve a comparar; **no se afirma
que los 344 estén archivados bajo el checkout compilador**. Los campos
sourceCommit/sourceChangesRaw/sourceGitErrors originales se preservan sin
normalizarlos. Los reportes generados quedan distinguidos de los cuatro cambios
del candidato en inputs de compilación/runtime.

| Plataforma / Node | Artifact ID | SHA-256 del addon |
|---|---:|---|
| Linux / 22 | 12625248806 | a2777cbf00baa2cc7aa67c1098d6a5ceba4009aa6e514d558aac0b304e7ea583 |
| Linux / 24 | 12625768503 | a2777cbf00baa2cc7aa67c1098d6a5ceba4009aa6e514d558aac0b304e7ea583 |
| macOS / 22 | 12625023552 | c7f1624b3378042d9f903ae03d9b71d671da01d09a3da4ba96da0a6698a57244 |
| macOS / 24 | 12626485322 | c7f1624b3378042d9f903ae03d9b71d671da01d09a3da4ba96da0a6698a57244 |
| Windows / 22 | 12626232873 | 9e46eca50f42636812e8906665d856de8815e5dca1ac0dfe29c665aa1e615a0e |
| Windows / 24 | 12626003237 | 4f701bf21768fb029ae336ec05be6b2aa63f3cdd5a673b518f2bcf294b9168fd |

El ELF seleccionado para una preparación posterior es el de Linux/Node24,
artifact12625768503; coincide con Linux/Node22. No es el ELF local `a6a21c3c`,
ni los candidatos históricos rechazados. Los binarios Windows difieren; no se
afirma reproducibilidad binaria entre sus compilaciones.

## Lectura sin ejecutar DOM

Desde la raíz del repositorio, los comandos actuales son:

```sh
python -B reports/validation/range-numeric-composed-candidate/hosted/tools/verify.spec.py . reports/validation/range-numeric-composed-candidate/hosted/40263224006
python -B reports/validation/range-numeric-composed-candidate/hosted/tools/verify.py . reports/validation/range-numeric-composed-candidate/hosted/40263224006/artifact-12625768503
```

Nueve contratos pasaron en Windows y Linux: incluyen la lectura de los seis
artefactos reales, identidades inválidas, manifiestos incompletos, bytes
alterados y ZIP reseñado coherentemente. No cargan addon, scripts ni módulos del
archivo. Se conservan logs de las pruebas y revisión local aislada.

Los recursos están resumidos en `reports/memory/range-numeric-composed-candidate/hosted/40263224006/`.
Los dos gates ownership siguen rechazando rendimiento. No hubo nueva captura,
tag ni merge, y no se cambiaron presupuestos ni rechazos históricos. El runtime
sigue híbrido. El análisis prospectivo de bloques no demuestra todavía potencia
suficiente para activar un método nuevo.
