# Selección nativa de nodos asignados

Rust calcula los candidatos actuales de un slot. Encuentra su raíz ordinaria,
consulta el host solo para una relación ShadowRoot y verifica que sea el
primer slot HTML con ese nombre. Después filtra los hijos directos del host
en orden usando los nombres nativos. Esos son los nodos cuyo padre puede
seleccionar un slot de esa raíz en el DOM real; se evita buscar entre todos
los slots por cada descendiente del host.

Los hosts de templates, los slots en light DOM y los slots duplicados que no
son primeros no reciben candidatos. Se conserva la herencia CDATA de Text de
jsdom; el concepto general isSlotable permanece intacto. El resultado es un
vector temporal de IDs, convertido a las referencias originales. No agrega
índices, caches ni owners persistentes.

El driver conserva la comparación con listas cacheadas, la señal de slotchange,
la actualización de `_assignedSlot` y el aplanado. La API raw findSlotables
consulta la raíz registrada del slot; los registros raw pueden representar
varios roots por host, mientras el driver DOM utiliza la ShadowRoot real.

## Contratos focales

Los diez tests Rust de slots/nombres, Clippy y build pasaron. Dieciocho contratos
Node cubrieron parsing nativo/con posiciones/con scripts, eventos, GC, nombres,
CDATA, asignación densa, duplicados, movimiento de slots y límites entre árboles.
El contrato raw adicional pasó después: snapshots independientes, errores,
contadores inmutables y liberación de nodos con los IDs de resultado retenidos.

Memcheck aprobó los diez tests en
`../memory/2026-09-13T03-28-43.026Z-slot-query-valgrind.log`: cero errores y
cero pérdidas definitivas o indirectas, con 48 bytes posibles y 544 alcanzables
de std/libtest sin supresiones. Se conservan salida de tests y hash del ejecutable.

El estrés en cinco modos pasó en
`../memory/2026-09-13T03-29-51.792Z-linux-x64.json`. Incluye consultas frescas
de asignados en los ciclos de teardown. Rustdom liberó 1.322 documentos y 882
ventanas; cada modo Vitest liberó 1.320 documentos y 880 ventanas. Heap/RSS:
2,72/20,52 MiB rustdom, 4,02/97,57 MiB Vitest y 3,65/99,53 MiB VM. Son controles
finitos; RSS incluye el allocator y no demuestra ausencia absoluta de fugas.

La validación integral aprobó **148 tests Rust, 495 contratos Node, 7 Jest,
18 Vitest y 26 VM**, junto a 1.784 casos HTML5 comparables. WPT conserva los
43.708 casos ejecutables en paridad (42.678 aprobados por estándar y 1.030
fallos compartidos) en
`../compatibility/2026-09-13T03-35-55.804Z-linux-wpt.json`. El bootstrap bloqueado
de Range-deleteContents sigue declarado y no se cuenta como cobertura aprobada.

## Benchmarks

`../benchmarks/2026-09-13T03-26-00.747Z-linux-x64.json` conserva 18 muestras
por motor/caso, sin otros runners locales simultáneos. El caso denso prepara
25/100 slots y 50/200 Element hijos, con el target inicial en el último slot.
Consulta assignedNodes con flatten 100 veces, consumiendo longitud e identidades,
o alterna 100 nombres con hooks y lecturas de assignedSlot. Setup, assertions
finales y hashes de documento/ShadowRoot quedan fuera del timer.

| Operación | Slots | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| 1.000 lecturas assignedSlot, un candidato | 25 | 3,919 | 1,585 | 2,47× |
| 100 reasignaciones, un candidato | 25 | 1,893 | 1,135 | 1,67× |
| 1.000 lecturas assignedSlot, un candidato | 100 | 11,465 | 4,608 | 2,49× |
| 100 reasignaciones, un candidato | 100 | 3,573 | 1,768 | 2,02× |
| 100 consultas de asignados, host denso | 25 | 7,160 | 0,444 | 16,14× |
| 100 reasignaciones, host denso | 25 | 14,945 | 1,440 | 10,38× |
| 100 consultas de asignados, host denso | 100 | 96,680 | 0,997 | 97,00× |
| 100 reasignaciones, host denso | 100 | 184,099 | 2,388 | 77,10× |

Ratio = mediana jsdom / mediana rustdom. Son fixtures sintéticos que favorecen
eliminar búsquedas repetidas; no representan el tiempo de una suite completa.
No se afirma una comparación causal A/B contra el commit anterior.

El primer intento tenía una expectativa incorrecta: flatten devuelve el Text
fallback de los slots sin asignados. El jsdom independiente la rechazó y se
corrigió la comprobación, sin modificar el producto. Su diagnóstico permanece en
`../benchmarks/2026-09-13T03-20-26.404Z-linux-x64-edf51dc5-0458-450e-b3b0-77bedd56e3e7-failed.json`.

La selección de candidatos se ejecuta en Rust; los drivers de asignación,
aplanado y entrega de señales siguen pendientes. El objetivo integral no está
completo.

El paquete con SHA-256
`1a1c8aa2c4c49d684a0380c357e6c055a407d8d724784992e9eb358fac417c57`
pasó **18 controles en Node 24.14.1 y 18 en Node 22.12.0**, con npm/pnpm fuera
del checkout y consumidores CJS/ESM y runners reales. Los consumidores verifican
listas nativas y consultas frescas con CDATA. Informes:
`../distribution/2026-09-13T03-39-04.546Z-linux-x64.json` y
`../distribution/2026-09-13T03-41-21.602Z-linux-x64.json`.
