# Compatibilidad del candidato aislado de ownership

Se ejecutaron los seis comandos completos de pruebas del proyecto en Linux x64,
con Node 22.12.0 y 24.14.1, contra el addon real del candidato `cold-cleanup`.
El binario conserva SHA256
`9bab7909799346eedf30f380b78eb9dcbda085e38bc6eb82df9fda12eb0d1f7e`.
Las 971 fuentes copiadas desde f44f5dd0 siguen iguales salvo los dos atributos
de `PendingClassValue<T>::drop`. Fuentes y distribución construida quedan
inventariadas en sus manifiestos. El jsdom 27.4.0 de referencia permanece
independiente del runtime privado construido por rustdom.

| Runtime | Compatibilidad + procesos WPT | Jest | Vitest | VM | HTML comparados | Fixtures / aserciones WPT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Node 22 | 3774 + 9 | 22 | 33 | 34 | 1784 | 240 / 83007 |
| Node 24 | 3774 + 9 | 22 | 33 | 34 | 1784 | 240 / 83007 |

Los doce comandos finalizaron con exit 0. Los conteos describen estos corpus y
no se suman como porcentaje de migración ni certificación de estándares.
HTML excluye ocho casos `script-on`, conservando esa exclusión. WPT mantiene
las 1203 aserciones no aprobadas por versión que comparte con jsdom, el bloqueo `range-deletion`
por el bootstrap CDATA/HTML de la referencia y la exclusión del caso que necesita
test_driver/layout. `complete=false`: estas limitaciones no cuentan como cobertura
aprobada. Los detalles, mensajes y resultados íntegros están en el archivo.

## Preparación e historial conservado

La primera preparación aislada copió el addon y ejecutó el build JavaScript pero
omitió `dist/native.cjs`, que instala build:native. Fallaron cinco scripts; WPT
se detuvo explícitamente por esa preparación inválida. Se conservaron los logs,
los cinco procesos detenidos y la comprobación de que terminaron. No se usa ese
intento para aceptar compatibilidad.

El segundo intento ejecutó `scripts/build-native.mjs` y `scripts/build.mjs`
reales, verificó el mismo hash del addon e incluyó tres archivos de resultados
históricos que usan las regresiones WPT. Luego ejecutó `test:compat`, `test:jest`,
`test:vitest`, `test:vm`, `test:corpus` y `test:wpt` con cada Node fijado.
El controlador original terminó con exit 1 después de los seis comandos exitosos
de Node22 porque su glob contó también un JSON de diagnóstico. La selección se
corrigió a seis paths exactos y se comprobó offline, sin repetir las suites.

La revisión detectó y se corrigieron dos P2 de los controladores: rechazo temprano
de Python optimizado y lectura tanto de TAP como del reporter spec de Node24.
Los contratos ejercen intérpretes reales con `-O`, los logs reales de ambos Node
y salidas ajenas sin resúmenes. Se conservó el controlador ejecutado por Node22
y se comprobó su proceso sin `-O`/`PYTHONOPTIMIZE`; los comandos de Node24 registran
también los hashes del addon antes y después. No se ejecutó código archivado.

## Evidencia y límites

`functional-attempts.tar.xz` conserva ambos intentos sin omitir archivos regulares;
`members.json` identifica cada miembro por tamaño y SHA256. Los `.txt` de código
son snapshots legibles de procedencia, no entrypoints para ejecutar desde el
archivo. Usar los comandos del checkout correspondiente para reproducir pruebas.
`summary.json` incluye los doce recibos, corpus, bloqueos y exclusiones.

Los 1920 snapshots de recursos de los 960 procesos de fixtures se publican por motor y Node en
`reports/memory/cold-cleanup-compatibility.json`. No hubo GC forzado en esos
endpoints; no prueban memoria pico ni ausencia de fugas, y no observan Window y
Document débiles por separado. El Memcheck dedicado anterior conserva su alcance
finito y sus 48 bytes posibles/548 alcanzables en `cold-cleanup-candidate.json`.

El candidato sigue aislado y sin integrar. Esto no prueba compatibilidad del
candidato en Windows/macOS ni implementación completa en Rust. No se midió
rendimiento del candidato ni se repitieron las capturas consumidas. Los rechazos
históricos, `performanceAccepted=null` y el bloqueo del merge permanecen.
No hay tag ni merge. El próximo paso es preparar y revisar un protocolo separado,
con entradas y presupuestos fijados antes de cualquier autorización nueva.
