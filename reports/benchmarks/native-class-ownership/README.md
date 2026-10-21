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
