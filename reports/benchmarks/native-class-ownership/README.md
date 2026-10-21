# Coste del guard de ownership N-API

El protocolo A/B fijo terminó con exit 0: 16 bloques, 64 procesos de medición
y 4.608 duraciones medidas. Cada fila/Node/etiqueta/motor conserva 72 muestras
en ocho procesos, con tres warmups por proceso. Los reportes completos,
stdout/stderr, resúmenes y comprobante terminal están en `local/`.

A es checkpoint 67 y B agrega el guard. La fuente de la referencia tiene hash
`67523bf38c8bfd32286618de24cee952b684f32fd91a322c407f7111cd73be3f` y su binario
`e178142421fa9fc4b3b30525b1fae3d7a6eac8ffb9123711d09fbc915cda1a01`.
El candidato usa fuente `8332276799c5ccc18c7a45a5136a856b039736597d5e104e22f074f8e23f1ddd`
y binario `04863365060a1be4fe135880a89bdc1a289a0ae8247a0d3da922a90a9803069f`.
El driver verificó esas identidades antes/después de medir, cuatro workers por
bloque, salidas equivalentes, conteos y medianas. Ambas versiones de Node usan
el mismo addon N-API 8. El digest del harness se refiere al cwd candidato;
`runtimeSource` identifica el paquete realmente cargado también en A.

## Resultados completos

Variación = mediana B / mediana A menos uno. Un valor positivo es más tiempo.
El control es jsdom independiente, sin el parche en ninguna etiqueta. Los
presupuestos declarados son ±2% para ese control y +5% para el candidato.
Las cifras de la tabla están redondeadas; los JSON conservan precisión completa.

| Node | Carga / tamaño | Rust Δ% | jsdom control Δ% | Interpretación |
| --- | --- | ---: | ---: | --- |
| 22.12.0 | mutation-records-collect / 100 | +9,31 | +7,27 | Inconcluso |
| 22.12.0 | mutation-records-collect / 1000 | −0,81 | +5,58 | Inconcluso |
| 22.12.0 | observer-delivery-records / 100 | −2,69 | +1,90 | Dentro del presupuesto local |
| 22.12.0 | observer-delivery-records / 1000 | −64,21 | −7,71 | Inconcluso |
| 22.12.0 | range-control-1000 / 1000 | +9,41 | +0,79 | Investigar antes del checkpoint |
| 22.12.0 | range-control-1000 / 250 | −13,79 | +65,84 | Inconcluso |
| 22.12.0 | range-state-lifecycle-1000 / 1000 | −3,08 | +4,65 | Inconcluso |
| 22.12.0 | range-state-lifecycle-1000 / 250 | +4,05 | +9,18 | Inconcluso |
| 24.14.1 | mutation-records-collect / 100 | +2,60 | +0,23 | Dentro del presupuesto local |
| 24.14.1 | mutation-records-collect / 1000 | +1,19 | +14,99 | Inconcluso |
| 24.14.1 | observer-delivery-records / 100 | +1,29 | +1,93 | Dentro del presupuesto local |
| 24.14.1 | observer-delivery-records / 1000 | +0,66 | +10,75 | Inconcluso |
| 24.14.1 | range-control-1000 / 1000 | −2,78 | +1,53 | Dentro del presupuesto local |
| 24.14.1 | range-control-1000 / 250 | +2,93 | −2,15 | Inconcluso |
| 24.14.1 | range-state-lifecycle-1000 / 1000 | −0,74 | −10,29 | Inconcluso |
| 24.14.1 | range-state-lifecycle-1000 / 250 | −1,40 | −1,65 | Dentro del presupuesto local |

Diez de dieciséis controles no calibran. Las mejoras aparentes grandes de esas
filas no se atribuyen al parche. La fila señalada de Node 22 pasa de 14,69996 a
16,08318 ms; sus medianas por proceso también muestran dispersión. Requiere el
control negativo declarado en `DIAGNOSTIC-PROTOCOL.md` antes de decidir si hay
una regresión reproducible del candidato. En Node 24 esa misma fila registra
−2,78% con control +1,53%; no permite descartar el resultado de Node 22.

## Límites y siguiente comprobación

Linux/WSL, CPU 2; la afinidad del guest no aísla el host Windows. Se midieron
operaciones públicas reales con sus fixtures, validación de resultados y
activación nativa. Setup, módulo inicial, cleanup y GC explícito quedan fuera
del tiempo; la GC que suceda durante la operación forma parte de su coste.
La memoria almacenada es posterior a cleanup, no memoria pico.

El A/A diagnóstico usa la misma referencia en ambas etiquetas. La selección
automática del estudio completo solo habilita Node 22 y la familia
`range-control-1000`, con ambos tamaños. Se ejecuta una sola secuencia de ocho
bloques y no reemplaza ni prolonga este A/B. Terminó con exit 0; sus 32 procesos
y 576 duraciones están en `negative-control/`, con el comprobante terminal.

| Node 22, misma referencia | Rust Δ% | jsdom control Δ% | Calibración |
| --- | ---: | ---: | --- |
| range-control-1000 / 1000 | −0,3895 | −5,3452 | No calibra |
| range-control-1000 / 250 | +0,7013 | −20,5067 | No calibra |

El mismo motor conserva dispersión por proceso y los controles jsdom exceden
el margen. Esta fase no confirma causalidad del parche ni resuelve el +9,41%
original. No se repite el control local hasta aprobar. Queda pendiente resolver
la precisión/atribución mediante diagnóstico de la carga y del entorno antes
de aceptar ese presupuesto. El A/B y el A/A no acreditan ausencia de regresión.
Este hito corrige ownership y no acredita una aceleración global ni nuevas
APIs migradas. El checkpoint sigue pendiente de resolver la fila señalada y
completar revisión/CI de la publicación.

## Diagnósticos posteriores, sin repetir la aceptación

Los perfiles `profiles/` preservan los métodos y las fuentes instrumentadas.
El análisis vigente registra cero GC dentro de las 72 muestras y superposición
garantizada con compilación de fondo en 69, con calibración explícita del reloj.
Las antiguas cotas de CPU fueron rechazadas durante review y quedan identificadas;
no se utilizan para concluir costes o ahorros.

El control `native-copy/` ejerció el class return real: 32 procesos, 288
duraciones medidas y 3.840.000 copias incluyendo warmups, con verificación
de endpoints, independencia y liberación. A/A +2,0921%; A/B −1,8688% para
10.000 copias por muestra, dentro de los límites declarados del diagnóstico.
No reproduce una penalización en ese camino aislado y tampoco certifica una
mejora ni aprueba la fila pública original. Ver los README de cada diagnóstico.

`diagnostic-evidence.json` y `verify-diagnostics.cjs` conservan/verifican los
raws, compresión reversible y conclusiones vigentes. El SDK y el arnés original
permanecen idénticos a la validación publicada; no se cambió producción para
obtener estas mediciones.

La comprobación siguiente está predeclarada en `HOSTED-PROTOCOL.md`: una sola
secuencia independiente Ubuntu/Node 22 A/A + A/B de ambas filas públicas Range,
con el CLI original, tres warmups, nueve muestras y los presupuestos originales.
No hay todavía un resultado de esa comprobación en este commit. Sus cinco
contratos recalculan las observaciones históricas reales y protegen los archivos;
pasaron en Node 22.12.0/Linux y 24.14.1/Windows. Se ejerció además el generador
real de reportes parciales: el JSON, sus observaciones y hash se conservan antes
de propagar el fallo del CLI. El workflow pasó `actionlint`.

## Resultado del runner independiente

El run `39643090437` completó el protocolo y falló sus gates: ninguna fila
calibró. Se descargó el artefacto `12366716548`, cuyo ZIP tiene SHA-256
`3f2c2f3e6d03226a5160e77023647e6c52d464244f665abd00b6553625d8a266`,
coincidente con el digest de GitHub. Los 64 procesos y 1.152 duraciones se
recalcularon; fuentes, binarios, protocolos, orden y salidas coinciden.
Los raw, ZIP, log, procedencia y verificación están en `hosted/39643090437/`.

| Fase | Tamaño | Rust Δ% | Control jsdom Δ% |
| --- | ---: | ---: | ---: |
| A/A | 1000 | +4,3101 | +3,6005 |
| A/A | 250 | −0,4898 | −6,4675 |
| A/B | 1000 | +6,4527 | +213,4203 |
| A/B | 250 | +2,4348 | −24,8075 |

El presupuesto permanece inconcluso. No se atribuye al SDK una mejora ni una
regresión a partir de estos controles y no se relanza la misma medición para
obtener un resultado favorable. Una investigación posterior requiere una
hipótesis o un método nuevo justificado; los resultados anteriores permanecen.

Las publicaciones con fuentes A/B y bytes del driver/protocolo idénticos usan
`history.cjs` para seleccionar esta evidencia. El workflow verifica todos los
raw y vuelve a exigir `accepted=true`: conserva el fallo al reutilizar estos
datos. Una verificación fiel con `accepted=false` no aprueba el presupuesto ni
habilita merge/tag. Los contratos usan snapshots inmutables de las fuentes realmente medidas,
con hashes y procedencia en `fixtures/history-sources/`. El positivo no depende
del checkout actual ni de objetos Git antiguos; las regresiones cambian bytes
reales de candidato, referencia y cada archivo de protocolo para comprobar
`reuse=false`. También comprueban rechazo de otro candidato y ausencia de
evidencia, sin generar nuevas muestras.

## Resultado del método emparejado con realms nuevos

El método publicado en `ec80a0e4` completó su única secuencia fijada y mantuvo
sus seis archivos congelados. Los 32 procesos, 1.152 duraciones y 1.536.000
copias incluyendo warmups quedaron verificados y archivados en
[`paired/2026-10-21/`](paired/2026-10-21/README.md). Los últimos dos endpoints
de Window/Document son claros; se conservan las tres rondas por observación.

A/A no calibra: Rust −9,39%/−6,81% y control jsdom +105,22%/−1,40% para
250/1000. A/B registra Rust −6,59%/+2,05% y control −38,10%/−0,90%. Solo la
fila A/B de 1.000 cumple su margen; la aceptación global sigue siendo falsa.
No se compensa entre filas ni se cambia el presupuesto del estudio anterior.

La hipótesis de emparejar dentro de procesos no alcanzó para calibrar este
diseño. Se preserva exit 1 y no se repite la secuencia para buscar aprobación.
La carga e identidad de módulos son condiciones adicionales a investigar:
esta versión usa asignación fija y carga A antes de B. No se afirma causalidad.
El hito de ownership continúa abierto y no acredita una aceleración ni una
migración adicional de APIs.

## Diagnóstico A/A contrabalanceado

El protocolo `BALANCED-PROTOCOL.md` aisló una pregunta adicional: balancear la
carga de módulos, asignación de copias y orden de muestras, con probes simétricos.
Sus ocho celdas se ejecutaron una vez por motor. Conservó el sample y cleanup
originales, tamaños, warmups, muestras y umbrales. Los 16 procesos, 576 duraciones
y 768.000 copias públicas se verificaron y están archivados en
[`balanced/2026-10-21/`](balanced/2026-10-21/README.md).

Rust A/A quedó en −2,1335%/−0,3293%, pero jsdom en −31,7389%/−7,5229% para
250/1.000: ninguna fila calibró. El contrabalanceo no bastó para validar esta
carga. Se conserva exit 1, no se ejecuta A/B y `accepted=false` no cambia.
No se relanza la secuencia para obtener aprobación. El diagnóstico no mide el
candidato B ni resuelve el presupuesto original, merge o tag. Las diez fuentes
congeladas permanecieron idénticas y la revisión previa cerró el P2 de reserva
exclusiva. Los contratos reales del worker y los cinco contratos posteriores
del verificador pasaron en Node 22 y 24; ver la validación de `balanced-method`.
