# Copias canónicas de Attr y ownership del wrapper

La primitiva de bajo nivel copia en Rust nombre local, namespace, prefijo y
valor de un Attr. El snapshot es independiente del árbol de origen, puede
reutilizarse entre árboles y conserva UTF-16, NUL y prefijos vacíos. Un destino
debe estar nuevo, vacío y desconectado; su validación precede a la activación.
Los getters JavaScript que se agreguen sobre el wrapper no intervienen al
inicializar los datos Rust del destino.

Esta rama prepara la migración del clonado. El driver público de `cloneNode`
y `importNode` continúa en JavaScript sobre el almacenamiento Rust de
checkpoint 65. La primitiva no completa ese hito ni retira por sí sola un
módulo de plataforma del runtime JavaScript. Su benchmark de copia de datos
tampoco mide el rendimiento completo de un clonado DOM.

## Validación ejecutada

| Control | Resultado |
|---|---|
| Rust 1.98.1 y 1.99.1 | 316 tests por toolchain; formato y Clippy con warnings denegados |
| Node 22.12.0 y 24.14.1 | 3.645 contratos Node por versión |
| Runners, por Node | Jest 21; Vitest 32; VM 32 |
| HTML5, por Node | 1.784/1.784 casos comparables; ocho casos script-on excluidos |
| WPT, por Node | Paridad en 240 fixtures; conserva fallos de estándar compartidos, una exclusión y una familia bloqueada; `complete=false` |
| GC focal, por Node | 16 endpoints comprobados, 288 snapshots entre warmup y ciclos medidos, en default/VM |
| Workers, por Node | Cuatro cierres normales con ocho snapshots vivos; ocho terminaciones durante preparación |
| Memcheck | 316 tests reales en diez lotes; incluye los seis tests nuevos del guard de ownership |
| Paquete instalado, por Node | 22 controles npm/pnpm, consumidores CJS/ESM tipados y runners reales |

El addon release se compiló con Rust 1.99.1 y se ejerció con ambos Node. El
comando de empaquetado comprobó que conservaba exactamente ese binario.
Los resultados locales corresponden a Linux x64; los checks de las demás
plataformas deben verificarse en CI antes del merge.

Los comandos completos están en `commands/validate-attribute-copy-final.sh`.
`final/` contiene los logs finales; los reportes crudos de compatibilidad,
memoria, distribución y los intentos anteriores se conservan en
`raw-validation-memory-distribution.tar.gz`. Los nombres referenciados por los
logs distinguen la matriz final de su historia. El manifiesto identifica
fuentes, binario y paquete; la extracción de `validated-sources.tar.gz` se coteja
contra el mismo digest de 329 fuentes medidas.

## Fuga reproducida y corregida

Al terminar un worker durante la preparación de un Attr de 4 MiB, el SDK
anterior podía perder la asignación Rust antes de `napi_wrap`. Se reprodujo en
Node 22 y 24 con el binario anterior: después del cierre y cuatro GC seguía
vivo un snapshot, con 4.194.474 bytes propios y cero bytes contabilizados a V8.
La regresión nueva falla contra ese binario en el primer ciclo.

`PendingClassValue<T>` libera la asignación si falla la construcción antes del
wrap. Cuando se registra el finalizador, transfiere su propiedad: un error de
tag posterior no debe liberar el mismo valor por segunda vez. El guard conoce
los dos layouts de clases de tamaño cero empleados por el SDK. La fábrica
restaura su estado anterior y asigna el bookkeeping de referencias después de
un wrap correcto. Los tests Rust ejercen deallocación, transferencia, errores
y tamaños cero; el test de worker ejerce el addon y el error reales.

`ownership/termination-*-before-*` y los logs de la regresión anterior muestran
el fallo; `ownership/termination-after-final-*` registra el binario final con
`live=0`, `created=1`, `released=1` y bytes propios/contabilizados en cero.
El binario fallido se usa únicamente como control negativo. Esta corrección
cubre el camino `new_instance<T>`; no certifica todos los caminos de error del
SDK ni toda la plataforma DOM.

## Memoria y alcance

Los snapshots conservan únicamente datos Rust propios. No contienen handles,
forests, documentos, ventanas ni referencias de JavaScript. Su capacidad se
informa a V8 después del wrap y se compensa al finalizar; el contador incluye
estado/wrapper Rust y capacidades de strings, sin incluir bookkeeping del
SDK/V8, metadata del allocator o memoria pico. El aviso es una ayuda de presión de GC, no una
garantía de recolección inmediata
([Node-API 22.12.0](https://nodejs.org/download/release/v22.12.0/docs/api/n-api.html#napi_adjust_external_memory)).

Los escenarios focales retienen tres snapshots por owner, incluido uno de
64 KiB, mientras exigen liberar Window, Document, Element, Attr, impl y árboles
nativos independientes. Después liberan los snapshots y exigen también sus
WeakRef y contadores nativos en el valor inicial. Cada endpoint debe alcanzar
su condición; el reporte se guarda antes de fallar si no lo logra. Los cinco
modos generales observan documentos y ventanas por separado.

Son pruebas finitas de ciclos de vida y contadores, no una demostración de
ausencia absoluta de fugas. Memcheck cubre el ejecutable de tests Rust; los
workers y endpoints cubren el addon real. Los logs conservan también residuos
posibles/alcanzables del harness. Heap, memoria externa y RSS después de GC no
equivalen a memoria pico ni permiten atribuir toda retención al DOM.

## Rendimiento y publicación

La comparación controlada y su evaluación del presupuesto de +5% están en
`reports/benchmarks/attribute-copy/`. No crear un checkpoint hasta evaluar todas
las filas, completar la revisión del SHA final y verificar CI. El objetivo
integral y el inventario auditado de migración siguen pendientes.
