# Estudio completo de fixtures compartidos: rechazado

Una única ejecución autorizada de `ownership-shared-fixtures-v1` terminó completa,
con integridad verificada y rendimiento **no aceptado**. El run
[40012710923](https://github.com/guidomodarelli/rustdom/actions/runs/40012710923),
job `120616868608`, intento 1, ejecutó el commit
`14c2cc236ebcf68abc7c9d06f4b5b88e35e57ab4`.
La autorización humana, el intento de activación y su respuesta están conservados
en `authorization/`. No hubo relanzamiento ni mediciones locales nuevas.

## Decisión y alcance

- 2048 procesos completos: 1024 en Node 22.12.0 y 1024 en Node 24.14.1.
- 18432 duraciones medidas y 6144 de warmup; todas en `spans.csv` y en los reportes crudos.
- 32 comparaciones, ocho filas × AA/AB × dos Node. Estimador original, semillas 1..16 y presupuestos sin cambios.
- 11 controles jsdom incumplen ±2%: nueve en Node 22 y dos en Node 24.
- Un exceso numérico del candidato: Node 22, AB, `mutation-records-collect/100`, +10.305288372233301% frente al límite +5%.
  El control jsdom de esa misma celda es +2.0665321406441173%, también fuera de presupuesto.
  Ese exceso observado no demuestra una regresión causal de Rust en un control rechazado.
- Cinco filas AA no calibradas y seis filas AB fuera del gate; los conjuntos se solapan con los controles/excesos anteriores.

El código de salida de captura fue 1, correspondiente a rechazo numérico;
no hubo error de integridad ni timeout. La medición duró 2 h 48 min 9 s y el job
2 h 51 min 39 s, incluido el archivo y la subida, dentro de los 180 minutos.
Cada worker conserva su límite de 180000 ms. El estudio serial de 2048 procesos
es distinto del CI ordinario, ya aprobado en el mismo SHA.

Los fixtures compartidos no resolvieron la inestabilidad de los controles.
No se eliminan filas, semillas, warmup ni resultados desfavorables. Este estudio
no reemplaza ni convierte en aprobado el rechazo histórico `39921160254`.
El runtime sigue siendo híbrido; esta evidencia no certifica un DOM íntegro en
Rust, compatibilidad total ni mayor velocidad que jsdom.

## Todas las comparaciones

| Node | Fase | Fila | Cambio candidato | Control jsdom | Gate de fila |
| --- | --- | --- | ---: | ---: | --- |
| v22.12.0 | AA | mutation-records-collect/100 | -3.5747% | -0.1899% | sí |
| v22.12.0 | AA | mutation-records-collect/1000 | -0.4789% | +1.3893% | sí |
| v22.12.0 | AA | observer-delivery-records/100 | -0.3011% | -0.1866% | sí |
| v22.12.0 | AA | observer-delivery-records/1000 | +0.1381% | +0.2100% | sí |
| v22.12.0 | AA | range-control-1000/1000 | -2.3859% | +4.5250% | no |
| v22.12.0 | AA | range-control-1000/250 | -0.8819% | -5.0387% | no |
| v22.12.0 | AA | range-state-lifecycle-1000/1000 | -1.7605% | -7.2777% | no |
| v22.12.0 | AA | range-state-lifecycle-1000/250 | +0.1429% | +2.0376% | no |
| v22.12.0 | AB | mutation-records-collect/100 | +10.3053% | +2.0665% | no |
| v22.12.0 | AB | mutation-records-collect/1000 | -2.2133% | +2.4359% | no |
| v22.12.0 | AB | observer-delivery-records/100 | -0.0900% | -2.9643% | no |
| v22.12.0 | AB | observer-delivery-records/1000 | -0.1110% | +0.1642% | sí |
| v22.12.0 | AB | range-control-1000/1000 | -1.4168% | +1.2269% | sí |
| v22.12.0 | AB | range-control-1000/250 | -0.8301% | -1.2879% | sí |
| v22.12.0 | AB | range-state-lifecycle-1000/1000 | +1.0141% | -2.8350% | no |
| v22.12.0 | AB | range-state-lifecycle-1000/250 | -0.7816% | +4.4099% | no |
| v24.14.1 | AA | mutation-records-collect/100 | -0.7681% | +0.2013% | sí |
| v24.14.1 | AA | mutation-records-collect/1000 | +0.5012% | +0.3608% | sí |
| v24.14.1 | AA | observer-delivery-records/100 | -0.6830% | +0.1023% | sí |
| v24.14.1 | AA | observer-delivery-records/1000 | +0.8238% | +0.2203% | sí |
| v24.14.1 | AA | range-control-1000/1000 | +3.1706% | +0.6659% | sí |
| v24.14.1 | AA | range-control-1000/250 | -1.3040% | +0.0252% | sí |
| v24.14.1 | AA | range-state-lifecycle-1000/1000 | -0.0927% | -1.5724% | sí |
| v24.14.1 | AA | range-state-lifecycle-1000/250 | -0.3778% | -9.6347% | no |
| v24.14.1 | AB | mutation-records-collect/100 | +1.5955% | +1.8914% | sí |
| v24.14.1 | AB | mutation-records-collect/1000 | +0.0732% | +1.0804% | sí |
| v24.14.1 | AB | observer-delivery-records/100 | -2.5567% | -0.7165% | sí |
| v24.14.1 | AB | observer-delivery-records/1000 | -1.9384% | +0.2285% | sí |
| v24.14.1 | AB | range-control-1000/1000 | +0.2461% | +0.8122% | sí |
| v24.14.1 | AB | range-control-1000/250 | -3.2844% | +1.0850% | sí |
| v24.14.1 | AB | range-state-lifecycle-1000/1000 | -1.7982% | +0.8231% | sí |
| v24.14.1 | AB | range-state-lifecycle-1000/250 | -0.0702% | -3.7384% | no |

Los valores completos, medianas por proceso y hashes públicos permanecen en
`analysis.json`, `replay-node22.json`, `replay-node24.json` y el archivo original.
`comparisons.csv` permite inspeccionar las 32 filas sin seleccionar favorables.

## Transporte e integridad

Artifact GitHub ID `12536755023`:

- ZIP: 24890432 bytes; SHA256 `da8bc23906f2961e8e0c75ca5d5c823fd6f51b51e24cb184d4e2b4c53d620a9e`.
- Tar original: 24942664 bytes; SHA256 `09a49f6d126028c2ab870fc9cd5d7c748da22f3beb827705367852c45ff51e38`.
- Se preservan ambos archivos íntegros, metadata API, log de job, stdout/stderr y exit-code de captura.
- Extracción: 15705 archivos regulares, 1383519960 bytes crudos y seis enlaces.
  `raw-members.json.gz` contiene el manifiesto completo de 18654 miembros.
- El lector autenticó run, commit, intento, job, tamaño, digest API y CRC ZIP.
  El extractor existente comprobó rutas y enlaces; no se ejecutó código archivado.
- Los 26 pins publicados y el grafo congelado de 434 archivos permanecen intactos.
  Runtime source `5ef668c47a78bb73ef5b0881fbf20e6d36c4d4cc9686198c26e722d8fc9c6806`;
  harness `97284800087ef5e3a1e53d87a338a1e366cec220e654fd289d6b02bc8d812c7b`.

## Replay y pruebas

Los replays con el verificador publicado, en Node 22.12.0 y 24.14.1 sobre Linux,
terminan exit 0, `verified=true`, `accepted=false`, con bytes idénticos:
SHA256 `a2bf8c0238ec36213dbc7e4370fb5da3b589bd461c5f985b39e9a889d23d544a`. La lectura exit 0 valida la
reproducción del rechazo; no aprueba el rendimiento.
El análisis en ambos Node también produce los cuatro archivos byte-idénticos.

Se usa un checkout Git real, limpio, en el commit fuente 14c2cc23. El verificador
incluye `sourceCommit`, `sourceChanges` y `sourceGitErrors` en su comparación;
ejecutarlo desde un HEAD posterior o un worktree Windows ilegible para Git de
WSL no reproduce esa identidad. No se normaliza ni falsea metadata para hacerlo pasar.

Los seis contratos de `tools/contracts.spec.cjs` por Node ejercen los 80 workers
auténticos de la calificación funcional previa y rechazan ausencia/retención de
Window, sustitución de baseline, promoción del corpus funcional y escritura por
symlink dentro del original. Los ocho tests de `tools/transport.spec.py` ejercen
el artifact real y sustituciones de identidad/bytes. Logs en `validation/`.
Tres pruebas de `tools/artifact.spec.py` contrastan cada span CSV con su reporte
original, todas las comparaciones y la decisión negativa íntegra de ambos replays.
Los intentos previos de cinco y seis contratos se conservan sin ocultarlos.

Para reproducir offline en Linux, con los dos Node fijados disponibles:

```sh
# Desde el repositorio actual, crear un checkout real limpio del método fuente.
git worktree add --detach ../rustdom-study-source-14c2 14c2cc236ebcf68abc7c9d06f4b5b88e35e57ab4
python3 reports/benchmarks/native-class-ownership/shared-fixture-study-results/40012710923/tools/extract.py \
  "$PWD" "$PWD/reports/benchmarks/native-class-ownership/shared-fixture-study-results/40012710923" /tmp/rustdom-study-new-extraction
# Ejecutar el código del checkout revisado, nunca scripts dentro del archivo extraído.
NODE22=/ruta/a/node-22.12.0/bin/node
NODE24=/ruta/a/node-24.14.1/bin/node
"$NODE22" ../rustdom-study-source-14c2/reports/benchmarks/native-class-ownership/shared-fixture-study/study.cjs \
  --verify /tmp/rustdom-study-new-extraction/shared-study/capture
"$NODE24" ../rustdom-study-source-14c2/reports/benchmarks/native-class-ownership/shared-fixture-study/study.cjs \
  --verify /tmp/rustdom-study-new-extraction/shared-study/capture
```

El directorio de extracción debe ser nuevo y estar fuera de los inputs.
Los lectores no ejecutan DOM, addon ni sampler. El runtime de producción no
cambió; estos tests no sustituyen sus suites existentes.

## Recursos y siguiente paso

Ver `memory.json` y `reports/memory/shared-fixture-study-40012710923.md`.
Se preservan las primeras rondas no claras y los snapshots del padre.
No son mediciones de memoria pico ni una garantía universal de ausencia de fugas.

No hay tag ni merge con este rechazo. No se integra una aceptación falsa al gate,
no se repite la secuencia y no se amplían presupuestos. Queda investigar los
controles y la fila numérica desde los datos existentes y preparar cualquier
cambio metodológico futuro como un estudio distinto, sin ejecutarlo bajo esta
autorización ya consumida. El objetivo general y la migración siguen pendientes.
