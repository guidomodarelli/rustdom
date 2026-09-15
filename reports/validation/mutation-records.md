# Payload nativo de MutationRecord

Los nueve campos del registro público se respaldan con un snapshot Rust
inmutable. El estado contiene el tipo, textos UTF-16 con null diferenciado de
cadena vacía, IDs de target/siblings y listas ordenadas de IDs. No contiene
referencias JavaScript ni retiene NativeTree; valida los handles antes de crear
el snapshot y no modifica el árbol. Las lecturas raw sobreviven a su liberación.

El puente conserva los owners visibles a V8. Un WeakRef al propio registro se
desreferencia antes de convertir sus IDs, manteniendo esos owners durante el
trabajo síncrono. Los NodeLists usan la factory real del realm original y el
wrapper WebIDL existente conserva SameObject. Las listas son estáticas incluso
después de mover o adoptar los nodos. Retener solo una lista permite recolectar
el registro, mientras la lista conserva sus nodos como requiere el contrato.

Se reutiliza la conversión de DomString del árbol: toma prestado UTF-8 válido
y transfiere UTF-16 cuando hay surrogates aislados. La primera integración
detectó que Option<Utf16String> en un objeto N-API rechazaba null explícito.
Se corrigió el binding para aceptar texto, null y ausencia mediante
Option<Either<Utf16String, Null>>, conservando las aserciones públicas originales.
La [ejecución fallida](../memory/2026-09-13T08-56-36.127Z-mutation-records.json)
y la [corregida](../memory/2026-09-13T08-59-05.690Z-mutation-records.json)
permanecen como evidencia.

## Contratos y memoria

Tres tests Rust verifican los tres tipos, snapshots, nulabilidad, orden,
duplicados y rechazo atómico de referencias inválidas o reservadas. Ocho tests
Node ejercen jsdom independiente y el runtime real, opciones de oldValue,
takeRecords, callbacks, creación ilegal, nombres con UTF-16, Text/Comment/CDATA/PI,
identidad, listas estáticas, adopción y realm. Los controles raw verifican
ausencia/null, lecturas tras liberar el árbol y contadores ante errores.

El [control de cinco ciclos](../memory/2026-09-13T09-12-16.222Z-mutation-records.json)
aprobó las retenciones deliberadas y la liberación posterior de registros,
Document, Window y nodos. También conserva una caja NativeMutationRecord raw
mientras su NativeTree se recolecta; soltar la caja devuelve el contador nativo
al baseline. El endpoint general de memoria exige ese mismo contador baseline.

Memcheck aprobó los tres tests del módulo sin errores ni pérdidas definitivas
o indirectas. El [log completo](../memory/2026-09-13T09-15-49.468Z-mutation-records-valgrind.log)
incluye 48 bytes posiblemente perdidos del contexto de threads std/libtest y
544 bytes alcanzables del runtime std, sin supresiones. Se guardan también la
salida de tests y el hash del ejecutable. Esto cubre escenarios finitos; no es
una prueba de ausencia absoluta de fugas ni reemplaza los controles N-API/V8.

## Validación integral

La validación integral aprobó 172 tests Rust, 529 contratos Node, 7 Jest,
18 Vitest y 26 VM, además de 1.784 casos HTML5 comparables. El
[WPT ejecutado](../compatibility/2026-09-13T09-17-44.423Z-linux-wpt.json)
conserva 43.708 casos en paridad, 42.678 aprobados por estándar y 1.030 fallos
compartidos. Los ocho casos HTML script-on excluidos y el bootstrap de
Range-deleteContents bloqueado siguen explícitos; no acreditan compatibilidad
integral.

El [estrés de cinco modos](../memory/2026-09-13T09-19-32.822Z-linux-x64.json)
aprobó jsdom, rustdom, native, Vitest y Vitest VM. Rustdom liberó los 1.322
documentos y 882 ventanas observados, con 2,77 MiB de heap y 18,27 MiB RSS
retenidos tras warmup y GC. Vitest y VM liberaron 1.320 documentos y 880 ventanas
cada uno; sus deltas heap/RSS fueron 4,05/73,80 y 3,66/27,06 MiB. El RSS mayor
de Vitest queda registrado, sin ocultarlo ni interpretarlo por sí solo como
fuga. Todos los contadores de lifetime, incluidos mutationRecords, volvieron
al baseline. No se mide memoria pico.

## Rendimiento

La [comparación aislada](../benchmarks/2026-09-13T09-22-08.127Z-linux-x64.json)
usa 18 muestras por motor y caso, con procesos y órdenes alternados. Cada grupo
ejecuta una mutación de atributo, una de Text y una inserción de hijo. Collect
mide esas mutaciones públicas y takeRecords; Read prepara los registros antes
del timer y consume los nueve campos y ambas listas una vez. Setup, validación
de cada campo/identidad, entrega de callbacks y limpieza quedan fuera del timer.

| Operación | Grupos (registros) | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Mutaciones y recolección | 100 (300) | 1,687 | 4,053 | 0,42× |
| Lectura de registros | 100 (300) | 1,398 | 2,483 | 0,56× |
| Mutaciones y recolección | 1.000 (3.000) | 9,071 | 31,306 | 0,29× |
| Lectura de registros | 1.000 (3.000) | 12,821 | 23,587 | 0,54× |

Ratio = mediana jsdom / mediana rustdom. Esta etapa agrega costo: el camino de
mutación/recolección tarda 2,4–3,5 veces más y la lectura aproximadamente 1,8
veces más que la referencia. No hay medición pareada anterior de este workload,
así que no se atribuye todo el diferencial a MutationRecord: collect incluye
algoritmos DOM previos. Reducir transferencias y pasos del puente sin devolver
estado o algoritmos a JavaScript permanece como trabajo explícito. Los hashes
de binario y fuentes y todas las muestras están en el reporte.

## Alcance pendiente

La selección y el registro de observadores, sus opciones y filtros, las colas
por observer y la entrega de callbacks siguen usando algoritmos JavaScript.
Este hito migra el payload completo de MutationRecord y sus lecturas; no cierra
MutationObserver ni la migración o compatibilidad integrales.

## Distribución

El primer paquete compilaba los tipos pero fallaba al ejecutar el consumidor
CJS instalado: la lista explícita de archivos de runtime no incluía el nuevo
mutation-record.cjs. Se corrigió esa lista en scripts/package.mjs; se conservó
la prueba de integración real, sin alterar las aserciones ni agregar mocks.
El [reporte fallido](../distribution/2026-09-13T09-26-17.779Z-linux-x64.json)
y el log de instalación preservan MODULE_NOT_FOUND y el paquete afectado.

El paquete corregido
`dd2fd766520390562a74f078337cf0eac4ad4c9d4d829e582f2f6ba8ff1e0279`
aprobó 18 controles en [Node 24.14.1](../distribution/2026-09-13T09-29-33.990Z-linux-x64.json)
y 18 en [Node 22.12.0](../distribution/2026-09-13T09-31-12.616Z-linux-x64.json).
Los consumidores npm y pnpm instalados fuera del checkout ejercen tipos
CJS/ESM, payload raw con null/UTF-16, identidad y NodeList SameObject en VM,
contadores nativos, assets de workers y los runners reales. También incluyen
el fix de tipos de SlotAssignmentAction publicado en 7d4c3ac, integrado sin
conflictos antes de empaquetar. Ese fix no modificó el runtime del benchmark.
La corrección posterior del manifiesto de distribución tampoco cambia el
binario o el comportamiento medidos; el hash de fuentes del benchmark
identifica explícitamente el estado anterior del script de empaquetado.
