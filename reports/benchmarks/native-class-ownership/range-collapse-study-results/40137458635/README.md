# Captura de collapse: resultados pendientes

Único run autorizado y activado: `40137458635`, job `121001909695`, intento 1,
fuente `02291d6b7a234a26ffaf364a1f377766e2338e7a`. Mientras siga vivo, consultar
solo esos IDs. No reaplicar etiquetas, relanzar workflows, agregar muestras ni
ejecutar el sampler. No hay aceptación de rendimiento ni reevaluación del gate.

El lector actual de transporte fija la identidad inmutable `run.head_sha`.
GitHub actualiza `pull_requests[].head.sha` cuando avanza el PR; esa referencia
mutable no redefine la fuente del run. El push `9d97a2f0` permitió observar y
probar esta diferencia con la metadata real, sin repetir ninguna medición.

Desde un checkout del proyecto con Python y GitHub CLI autenticado:

```sh
python -c "from pathlib import Path; Path('.cache').mkdir(exist_ok=True)"
python -B reports/benchmarks/native-class-ownership/range-collapse-study-results/40137458635/tools/collect.py . .cache/range-study-collection-40137458635
```

Al terminar el mismo run, agregar `--collect` conserva log, metadata, ZIP y tar,
también ante fallo o rechazo. El transporte autentica nombre, run, fuente, intento,
tamaño, digest y CRC; la extracción y el replay requieren fijar primero los pins
del artifact real. Los campos de artifact permanecen `null` mientras no exista.
No ejecutar scripts del tar: usar lectores actuales del repositorio y el código
revisado de la fuente `02291d6b` para `study.cjs --verify` en ambos Node fijados.

El adaptador reutiliza el lector Git actual ya revisado y verifica sus bytes
antes de configurarlo para estos IDs. No carga código de ZIP/tar ni modifica el
watch compartido. Conserva snapshots de todas las lecturas y parciales en una
colección propia; rechaza salidas ajenas o enlaces y restaura `GH_REPO`.

Contratos con metadata y filesystem reales, sin mocks ni nuevas capturas:

```sh
python -B reports/benchmarks/native-class-ownership/range-collapse-study-results/40137458635/tools/transport.spec.py . .cache/range-study-collection-40137458635
```

Windows pasó siete casos y omitió únicamente el enlace de directorio por
`WinError 1314`; Linux pasó los ocho, incluido ese enlace real. Una segunda
lectura conservó exactamente los cuatro archivos del snapshot original. La
evidencia y los límites están en `reports/validation/native-class-ownership/range-collapse-current-reader/40137458635/`.

Plan inalterado: 2048 procesos, 18432 duraciones medidas, 6144 warmup,
24576 Window y 24576 Document separados, tres rondas y dos estados finales
claros por proceso, baselines y tres snapshots del padre. Son cantidades esperadas,
no resultados ya observados. Presupuestos ±2%/±5%; captura de 175 minutos dentro
de job de 180 minutos. Preservar también regresiones, rechazos y parciales.
El runtime sigue híbrido y la migración general continúa pendiente.
