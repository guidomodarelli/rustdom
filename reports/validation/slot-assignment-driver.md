# Driver nativo de asignación de slots

El recorrido simple o por árbol, la selección, las decisiones y los commits
se ejecutan en Rust. El controlador devuelve Signal antes de confirmar un plan
y Applied después de cada actualización de ownership. Ningún callback JS corre
con el store prestado por Rust. Los slots sin cambios se procesan dentro del
mismo paso, eliminando los cruces por slot que dominaban el perfil anterior.

El siguiente nodo se calcula antes del body, como en SymbolTree. Si la señal
mueve o retira ese nodo, se conserva el cursor ya capturado y el avance posterior
usa la topología actual. Los candidatos también se capturan antes de señalar.
La operación repara backlinks aun cuando la caché no cambió, y no borra los
backlinks antiguos al vaciar una lista, igual que jsdom 27.4.0.

Se valida todo el commit antes de mutar. Cada Applied vuelve inmediatamente al
bridge: un error en un slot posterior no puede ocultar actualizaciones anteriores
de ownership. Un error cancela buffers pendientes sin deshacer señales ya aceptadas
ni commits anteriores. El bridge cancela en finally y evita un cruce terminal
adicional cuando Applied ya tiene cursor vacío.

## Contratos y memoria

Cinco tests Rust cubren 1.000 slots sin cambios en un solo paso, captura de
candidatos, cursor retirado durante señalización, slots posteriores no visitados,
reparación de backlinks sin señal, cancelación de planes grandes, errores y
prefijos ya confirmados. Los contratos Node usan el addon y nodos reales para
verificar el protocolo, clases ajenas, el borde propio de señalización y GC;
no se reemplaza Promise ni otra biblioteca de plataforma.

El build detectó una importación duplicada del addon y se corrigió manteniendo
su guard. Clippy detectó tests antes de producción y se movió el módulo al final.
Una aserción se ajustó al error real de V8 para receptores ilegales: TypeError
con Illegal invocation, distinto de InvalidArg para argumentos de otra clase.
No se modificó la implementación para cambiar esos errores.

El [control focal](../memory/2026-09-13T08-00-34.896Z-slot-assignment-driver.json)
mantiene controladores raw completos, pendientes y cancelados durante cinco ciclos.
Aunque los objetos siguen retenidos, Document, Window y nodos se recolectan;
reanudar un pendiente cuyo árbol ya fue liberado falla y cancela su estado.
Al soltar los controladores, sus contadores también regresan al baseline.

Memcheck aprobó 31 tests nativos de slots/controlador sin errores ni pérdidas
definitivas o indirectas. El
[log completo](../memory/2026-09-13T08-14-35.107Z-slot-assignment-driver-valgrind.log)
conserva también 48 bytes posibles y 544 alcanzables de std/libtest, sin
supresiones; se guardan salida de tests y hash del ejecutable. Los controles
Node cubren por separado el addon y los owners V8.

El [estrés de cinco modos](../memory/2026-09-13T08-19-25.072Z-linux-x64.json)
aprobó jsdom, rustdom, native, Vitest y Vitest VM. Rustdom liberó 1.322 documentos
y 882 ventanas; cada Vitest liberó 1.320 documentos y 880 ventanas. Heap/RSS
retenido: 2,76/19,16 MiB rustdom, 4,03/26,37 MiB Vitest y 3,66/27,02 MiB VM.
Los contadores de controladores regresaron a su baseline. Estas mediciones se
toman después de warmup, teardown y GC, y no representan memoria pico.

## Validación y rendimiento

`npm run validate` aprobó 169 tests Rust, 521 contratos Node, 7 Jest, 18 Vitest
y 26 VM, además de 1.784 casos HTML5 comparables. El
[WPT](../compatibility/2026-09-13T08-18-24.949Z-linux-wpt.json) conserva 43.708 casos
en paridad, con 42.678 aprobados por estándar y 1.030 fallos compartidos. Las
exclusiones y el bootstrap bloqueado de Range-deleteContents siguen declarados;
la migración y la compatibilidad integrales permanecen abiertas.

El paquete `feef978c09267942178e8bdd28c7fba01d7fd78577d02c0db55b24066e8abb90`
aprobó 18 controles en [Node 24.14.1](../distribution/2026-09-13T08-18-39.979Z-linux-x64.json)
y 18 en [Node 22.12.0](../distribution/2026-09-13T08-21-12.707Z-linux-x64.json).
Los consumidores instalados con npm y pnpm fuera del checkout verifican los
exports CJS/ESM, pasos Signal/Applied/Complete y la integración real con runners.

La [primera comparación](../benchmarks/2026-09-13T08-06-18.802Z-linux-x64.json)
ya conserva el mismo workload completo y todas las muestras. La ráfaga de
100/1.000 slots pasó a 1,13×/1,64× frente a jsdom; también mostró el costo de
operaciones pequeñas. Se retiró luego el cruce terminal redundante del bridge;
la validación final anterior corresponde a ese estado.

La [medición final](../benchmarks/2026-09-13T08-26-59.084Z-linux-x64.json) conserva
18 muestras por motor/caso, con órdenes alternados y sin otros runners locales:

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Ráfaga, tres mutaciones por slot | 100 slots | 6,155 | 4,581 | 1,34× |
| Ráfaga, tres mutaciones por slot | 1.000 slots | 380,642 | 222,284 | 1,71× |
| 100 reasignaciones, un candidato | 25 slots | 2,018 | 2,478 | 0,81× |
| 100 reasignaciones, un candidato | 100 slots | 4,391 | 3,033 | 1,45× |
| 100 lecturas de caché | 25 slots | 0,072 | 0,206 | 0,35× |
| 100 lecturas de caché | 100 slots | 0,063 | 0,187 | 0,34× |
| 100 eventos por slots | 25 slots | 1,714 | 2,787 | 0,61× |
| 100 eventos por slots | 100 slots | 1,485 | 2,457 | 0,60× |
| 100 consultas frescas, denso | 25 slots | 8,959 | 0,435 | 20,58× |
| 100 consultas frescas, denso | 100 slots | 101,873 | 1,052 | 96,86× |
| 100 reasignaciones, denso | 25 slots | 17,030 | 2,729 | 6,24× |
| 100 reasignaciones, denso | 100 slots | 202,491 | 3,929 | 51,54× |

El baseline anterior medía 32,696/2.681,170 ms en rustdom para las ráfagas;
las nuevas ejecuciones registran 4,581/222,284 ms. Es evidencia de ejecuciones
separadas del mismo workload, no un experimento causal pareado. Ratio = mediana
jsdom / mediana rustdom. El informe completo conserva también lookup, aplanado
y retargeting. No se ocultan las regresiones restantes ni se garantiza acelerar
una suite completa: todavía hay costos de controladores y cruces en operaciones
pequeñas, además de familias delegadas a JavaScript.
