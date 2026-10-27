# Comparación pública completa con afinidad del principal

Método main-affinity-public-v2 declarado y revisado antes de medir. Head del método:
`2c92c82da1f9a9eee82549f7947be95f672e1ca8`; review limpia 6325872955.
La corrida única comenzó 2026-10-21T20:31:39Z y terminó 20:58:08Z.
Se completaron 128 procesos y 9.216 duraciones, sin filtrar muestras ni
ejecutar repeticiones adaptativas. Los 128 workers terminaron con exit 0.
Cada driver y el launcher terminaron con exit 1 por accepted=false.

Los trece archivos del método quedaron congelados antes de medir y no cambiaron.
Se comprobaron fuentes, addons, las distribuciones A/B completas de 569 archivos
cada una y la referencia independiente jsdom 27.4.0 antes/después. Los manifests
completos y los originales stdout, stderr, máscaras por TID y versiones se
conservan junto con las verificaciones offline y el recibo de review.

## Resultado y límites

Node 22 calibró 3/8 filas en A/A y 4/8 en A/B; solo 3/8 A/B quedaron dentro
del presupuesto. Node 24 calibró 5/8 en A/A y 3/8 en A/B, estas últimas dentro
del presupuesto. Ambas versiones conservan accepted=false: no se aprueba el
hito y no se habilita merge/tag. Los umbrales originales permanecen intactos.

La fila A/B mutation-records-collect/100 de Node 22 registró +5,057644% Rust y
control jsdom +0,166349%, por encima del presupuesto +5%. Su A/A no calibró
(Rust -5,585548%, control +3,377621%): no basta para atribuir la diferencia al
SDK. No se redondea el valor para aceptarlo. Range/1000 Node 22 tampoco
calibró: el problema inicial de atribución/presupuesto continúa pendiente.

El cambio de afinidad no bastó para calibrar todas las cargas públicas. No se
repite este protocolo para elegir una corrida favorable ni se convierten los
estudios anteriores en aceptados. La evidencia completa debe guiar la siguiente
investigación sobre precisión y coste, sin reducir filas, muestras o presupuestos.

## Todas las filas

### v22.12.0

| Fase | Carga/tamaño | Rust Δ% | Control jsdom Δ% | Calibra | Dentro del presupuesto |
| --- | --- | ---: | ---: | --- | --- |
| AA | mutation-records-collect/100 | -5.585548 | +3.377621 | No | No |
| AA | mutation-records-collect/1000 | -0.849087 | -2.980525 | No | No |
| AA | observer-delivery-records/100 | +0.732327 | +5.236566 | No | No |
| AA | observer-delivery-records/1000 | -0.034864 | +1.397227 | Sí | Sí |
| AA | range-control-1000/1000 | +5.491200 | +9.137977 | No | No |
| AA | range-control-1000/250 | +0.502951 | -0.585687 | Sí | Sí |
| AA | range-state-lifecycle-1000/1000 | +1.161042 | +0.493064 | Sí | Sí |
| AA | range-state-lifecycle-1000/250 | -4.696976 | +2.959060 | No | No |
| AB | mutation-records-collect/100 | +5.057644 | +0.166349 | Sí | No |
| AB | mutation-records-collect/1000 | +1.988767 | -1.538399 | Sí | Sí |
| AB | observer-delivery-records/100 | -1.861687 | -3.126741 | No | No |
| AB | observer-delivery-records/1000 | -5.353726 | +1.330936 | Sí | Sí |
| AB | range-control-1000/1000 | -1.267075 | +6.334907 | No | No |
| AB | range-control-1000/250 | -2.064181 | -9.347524 | No | No |
| AB | range-state-lifecycle-1000/1000 | -0.357612 | -4.032713 | No | No |
| AB | range-state-lifecycle-1000/250 | +2.962412 | +1.164987 | Sí | Sí |

### v24.14.1

| Fase | Carga/tamaño | Rust Δ% | Control jsdom Δ% | Calibra | Dentro del presupuesto |
| --- | --- | ---: | ---: | --- | --- |
| AA | mutation-records-collect/100 | -1.270488 | +2.258779 | No | No |
| AA | mutation-records-collect/1000 | -1.210476 | +0.720686 | Sí | Sí |
| AA | observer-delivery-records/100 | +3.713065 | -2.405360 | No | No |
| AA | observer-delivery-records/1000 | -1.289512 | +1.774381 | Sí | Sí |
| AA | range-control-1000/1000 | -0.538384 | +2.838061 | No | No |
| AA | range-control-1000/250 | -0.071837 | +1.191096 | Sí | Sí |
| AA | range-state-lifecycle-1000/1000 | +1.387914 | +1.000916 | Sí | Sí |
| AA | range-state-lifecycle-1000/250 | +2.156519 | -0.459582 | Sí | Sí |
| AB | mutation-records-collect/100 | +0.826908 | +1.474716 | Sí | Sí |
| AB | mutation-records-collect/1000 | +0.706107 | -2.902357 | No | No |
| AB | observer-delivery-records/100 | +3.482783 | -1.098792 | Sí | Sí |
| AB | observer-delivery-records/1000 | +0.094749 | -2.299302 | No | No |
| AB | range-control-1000/1000 | +2.192366 | +3.908882 | No | No |
| AB | range-control-1000/250 | +1.213805 | +2.402105 | No | No |
| AB | range-state-lifecycle-1000/1000 | +1.733484 | +2.547632 | No | No |
| AB | range-state-lifecycle-1000/250 | -0.555178 | -1.674395 | Sí | Sí |

## Validación y memoria

El verificador recalcula todos los archivos y agregados sin ejecutar benchmarks.
Los dieciséis contratos posteriores por Node 22/24 aprobaron con el archivo real
y copias privadas que alteran aceptación, afinidad, tratamiento, filas, hashes,
resultado o addon. Se conservan sus logs en la validación main-affinity-v2-evidence.
La matriz general 39670400737 del head medido aprobó sus ocho checks; el gate de
ownership previo conserva su fallo y no se cambia mediante este archivo.

memory-summary.json y reports/memory/native-class-ownership/main-affinity-v2-2026-10-21.json
conservan 9.216 observaciones posteriores a limpieza, agrupadas por versión/fase/
motor. Sus mínimos/máximos no son memoria pico. No hay WeakRefs de Window/Document
ni una prueba de liberación universal; no distinguen por sí solos allocator y fuga.
No sustituyen las regresiones de ownership, errores y workers publicadas para
los mismos binarios. No se migraron APIs DOM nuevas en esta entrega.
