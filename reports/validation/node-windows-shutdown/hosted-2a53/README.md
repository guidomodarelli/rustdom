# Corrección de Windows confirmada en GitHub Actions

Commit `2a53f88c9c272d2753f6ef052132bbb72ada62ee`, intento 1.
**18/18 jobs funcionales aprobados y CI general aprobado.**
El gate ownership conserva su rechazo numérico; el PR no está totalmente verde
y no habilita tag ni merge.

| Matriz | Run | Jobs | Comandos por job |
|---|---:|---:|---:|
| Range combinado | 40268998980 | 6/6 | 22 |
| Extremos y colapso numéricos | 40268999071 | 6/6 | 18 + probe crudo |
| StaticRange owners agrupados | 40268998982 | 6/6 | 24 |
| Validate rustdom | 40268998988 | aprobado | logs íntegros |
| Native class ownership | 40268999068 | rechazado | rendimiento histórico |

Cada matriz usa Linux/macOS Node22.12.0 y24.14.1, Windows22.12.0 y24.20.0.
Los seis jobs Windows aprobaron el smoke Node HTTP con cierre real y sin addon.
No se saltaron abortos, fixtures ni timeouts. La causa investigada, el repro
8/8 de Node puro y los límites de atribución están en el directorio padre.

## Transporte y lectura

Se conservan 18 ZIP, metadata API de cada artefacto, run, job e intento, logs
íntegros y manifiestos de cada miembro. `confirmed/transport-pins.json` fija
ID, nombre, tamaño y digest oficial, identidad y hash del job, metadata,
manifiesto y log. El lector los contrasta antes de abrir contenido como datos.
No se ejecuta código archivado. `summary.json` registra binarios y fuentes
efectivamente comprobadas; no se atribuye reproducibilidad a binarios Windows
distintos ni a fuentes no archivadas.

La colección inicial se conserva íntegra. La revisión encontró dos P2 en su
lector de transporte: `-O` podía desactivar asserts y una reanudación podía
aceptar un log parcial. `confirmed/` volvió a leer API/logs con recibos de éxito;
reutilizó los ZIP solo tras autenticar tamaño/digest contra el API recién leído.
La lectura de transporte no repite pruebas ni mediciones DOM. El colector final
también se reprodujo offline sobre los 18 archivos reales con sus recibos.

Una segunda revisión detectó caché Python y publicación mediante rename capaz
de reemplazar enlaces/destinos ajenos. El código actual compila el buffer fuente
leído y publica mediante hardlink exclusivo, rechaza symlinks y conserva parciales.
Pasaron ocho contratos del lector en Windows y Linux, nueve de transporte en
Linux y ocho en Windows; Windows omitió únicamente crear un symlink por falta
de privilegio. Ese mismo comportamiento y la carrera con un destino creado por
el proceso real se ejercieron en Linux. Los logs originales se conservan.
Los 786 pins históricos permanecen intactos. No se gastó cuota de review remota.

Los archivos `first-collector.py.txt` y `current-collector.py.txt` son registros
de fuente; no ejecutar código archivado. Usar el lector mantenido actual:

```sh
python -B reports/validation/node-windows-shutdown/hosted-2a53/tools/verify.py <repositorio>
python -B reports/validation/node-windows-shutdown/hosted-2a53/tools/verify.spec.py <repositorio>
python -B reports/validation/node-windows-shutdown/hosted-2a53/tools/transport.spec.py
```

## Alcance funcional y límites

Se ejecutaron Rust, addon real, consumidores tipados, Jest, Vitest, VM, corpus,
WPT y memoria. Cada job pasó1784 casos de corpus con8 script-on excluidos.
WPT comparó240 fixtures y83007 aserciones:81804 aprobadas y1203 resultados
adversos compartidos con jsdom por job; `complete=false` y todas las exclusiones
se conservan. Esto no certifica compatibilidad total de estándares.

El candidato numérico comprobó344 inputs antes/después con el qualifier;
167 están archivados y se recomprueban offline,177 no están en el ZIP.
Combinado/owners archivan9 de10 fuentes cambiadas declaradas; `scripts/build.mjs`
no está en el archivo de compilación. Se comprueba su huella en el recibo del
qualifier, sin afirmar que se releyó ese archivo desde el ZIP.

Los216 estados finales de memoria están también en
`reports/memory/node-windows-shutdown/hosted-2a53/`. No acreditan memoria pico ni
ausencia universal de fugas. El runtime de producción sigue híbrido; estos son
candidatos funcionales separados. `performanceAccepted=null` y
`gateReevaluated=false`: las regresiones y rechazos anteriores siguen vigentes.
