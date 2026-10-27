# Variación de las muestras de ownership ya publicadas

El estudio 39921160254 permanece completo, verificado y rechazado. Este análisis
reutiliza sus 2048 procesos y 18432 duraciones, sin ejecutar DOM, GC ni timers
del benchmark. No cambia la aceptación, límites, semillas o tamaño del estudio.

## Resultado que cambia la investigación

La variación aparece dentro de los procesos y entre procesos del control
jsdom, aunque sus copias ejecutan la misma distribución y no cargan el addon
Rust. No basta atribuir los trece controles rechazados a un costo del guard
nativo. Tampoco se deduce de estos tiempos que el guard carezca de costo.

En Node 22 AA, mutation-records-collect/100 tiene medianas por índice de
2,3721105 a 1,9406530 ms en A (-18,1888%) y de 2,6143335 a 1,9756690 ms
en B (-24,4293%). El contraste agrupado original sigue siendo +3,6199347%.
No se retiran las primeras muestras ni se recalcula el gate con las últimas.

Cada índice corresponde a un realm nuevo dentro del mismo proceso. El sampler
crea tres realms exteriores de warmup y nueve medidos; en cada uno hace el
warmup de operaciones y conserva su orden de GC declarado. La trayectoria
no es la estabilización de un único Window. Los tiempos no registran eventos
de compilación, pausas GC ni tiempo de CPU; no identifican cuál de esas causas
explica la variación. No se ejecutaron nuevas trazas ni capturas.

Se preservan las 64 combinaciones de Node/fase/carga/motor y las 128 celdas
de tratamiento, incluidas las filas favorables y rechazadas. trajectories.json
contiene las nueve medianas por índice, extremos, dieciséis medianas por
proceso, rutas originales y todas las copias físicas de cada celda.
all-rows.csv permite recorrer los 64 resultados; las particiones descriptivas
reutilizan datos y no son réplicas independientes ni estimadores de aceptación.

## Todos los controles jsdom

Índice 1→9 es el cambio entre medianas por índice. Spread es
(máxima mediana de proceso / mínima mediana de proceso - 1) × 100.
Ninguna columna nueva tiene un umbral de aprobación.

| Node | Fase | Carga | Control original % | Índice 1→9 A % | Índice 1→9 B % | Spread A % | Spread B % |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| v22.12.0 | AA | mutation-records-collect/100 | +3.6199 | -18.1888 | -24.4293 | 23.0061 | 17.7959 |
| v22.12.0 | AA | mutation-records-collect/1000 | +0.4203 | -0.2558 | +0.8766 | 6.6732 | 8.1503 |
| v22.12.0 | AA | observer-delivery-records/100 | -1.5455 | -1.7395 | -6.0699 | 13.5122 | 16.3726 |
| v22.12.0 | AA | observer-delivery-records/1000 | -1.2638 | +2.9335 | +2.2003 | 9.4130 | 8.8258 |
| v22.12.0 | AA | range-control-1000/1000 | -0.2466 | -7.3544 | -9.3525 | 32.7507 | 29.5003 |
| v22.12.0 | AA | range-control-1000/250 | +1.7116 | -7.3692 | -6.6192 | 100.8834 | 26.7778 |
| v22.12.0 | AA | range-state-lifecycle-1000/1000 | -2.7421 | +14.4501 | +10.4506 | 48.2381 | 65.3019 |
| v22.12.0 | AA | range-state-lifecycle-1000/250 | -2.7284 | +11.4407 | +7.3375 | 43.1847 | 21.1619 |
| v22.12.0 | AB | mutation-records-collect/100 | +3.4415 | -17.2815 | -13.8077 | 31.5509 | 13.8338 |
| v22.12.0 | AB | mutation-records-collect/1000 | +0.0007 | -0.1750 | -1.0536 | 12.2015 | 5.2478 |
| v22.12.0 | AB | observer-delivery-records/100 | -2.0397 | -5.6500 | -7.9823 | 16.5403 | 14.5744 |
| v22.12.0 | AB | observer-delivery-records/1000 | -0.1730 | -1.4398 | -0.3369 | 10.9032 | 6.3265 |
| v22.12.0 | AB | range-control-1000/1000 | +2.1800 | -14.9007 | -0.3436 | 32.9466 | 20.9514 |
| v22.12.0 | AB | range-control-1000/250 | +1.5470 | -7.1576 | +0.9739 | 37.2026 | 31.7815 |
| v22.12.0 | AB | range-state-lifecycle-1000/1000 | +2.3269 | +16.9998 | -3.5746 | 32.9171 | 33.1629 |
| v22.12.0 | AB | range-state-lifecycle-1000/250 | +1.7687 | +24.8761 | +4.2722 | 65.6464 | 23.1779 |
| v24.14.1 | AA | mutation-records-collect/100 | -7.4074 | -7.2621 | -8.0365 | 38.7436 | 32.1264 |
| v24.14.1 | AA | mutation-records-collect/1000 | -2.1265 | +26.6867 | +10.0932 | 16.3066 | 13.2266 |
| v24.14.1 | AA | observer-delivery-records/100 | -0.2771 | +2.8616 | -2.2084 | 9.7663 | 11.1664 |
| v24.14.1 | AA | observer-delivery-records/1000 | +0.6163 | -1.1449 | +0.0266 | 3.6805 | 5.6776 |
| v24.14.1 | AA | range-control-1000/1000 | -0.1148 | -12.9504 | -19.1341 | 20.6255 | 22.5867 |
| v24.14.1 | AA | range-control-1000/250 | +2.6674 | +0.3357 | +2.3265 | 26.4117 | 30.9244 |
| v24.14.1 | AA | range-state-lifecycle-1000/1000 | -1.3076 | +9.2059 | -13.5722 | 40.9006 | 55.8709 |
| v24.14.1 | AA | range-state-lifecycle-1000/250 | -1.5422 | -2.8761 | -13.5891 | 29.7641 | 37.2755 |
| v24.14.1 | AB | mutation-records-collect/100 | -1.2637 | -8.5371 | -9.2527 | 30.6768 | 33.3240 |
| v24.14.1 | AB | mutation-records-collect/1000 | +0.0962 | +2.6064 | +18.7947 | 31.7905 | 12.0830 |
| v24.14.1 | AB | observer-delivery-records/100 | +0.4294 | +3.2344 | +0.7388 | 9.4632 | 13.5406 |
| v24.14.1 | AB | observer-delivery-records/1000 | +0.2019 | -0.8490 | +0.8538 | 5.8765 | 5.6254 |
| v24.14.1 | AB | range-control-1000/1000 | -0.7538 | -14.1705 | -20.3204 | 11.6019 | 21.6756 |
| v24.14.1 | AB | range-control-1000/250 | -4.0190 | +0.9039 | +6.2400 | 31.9996 | 36.1105 |
| v24.14.1 | AB | range-state-lifecycle-1000/1000 | -2.0953 | +14.5862 | -5.8539 | 45.1323 | 47.9210 |
| v24.14.1 | AB | range-state-lifecycle-1000/250 | -2.7641 | -11.9489 | -9.9475 | 63.0734 | 26.0396 |

## Validación y reproducción

Pasaron diez contratos de comportamiento por Node 22.12.0 y 24.14.1:
lectura real del archivo completo, medianas originales, todos los procesos
y muestras, corrupción controlada y CLI. Ambos CLI produjeron bytes idénticos,
SHA256 `6eb9a500f174258e031dcfbacbfa759e0276d480c962d97389c6c8a63abb26ce`.
Los tres inputs consumidos se autentican contra el manifiesto ya publicado.

```sh
node --test reports/benchmarks/native-class-ownership/current-ownership-diagnostics.spec.cjs
node reports/benchmarks/native-class-ownership/current-ownership-diagnostics.cjs > trajectories.json
```

Este cambio afecta al lector descriptivo, sus pruebas y documentación; no
modifica la implementación productiva, el sampler ni los gates históricos.
No vuelve a ejecutar las suites de DOM o memoria: no hay un runtime nuevo.
El workflow de ownership ejecuta los diez contratos y guarda el JSON descriptivo
en ambos Node antes del gate. El comando histórico y su rechazo se conservan;
su nombre ahora indica que consume un estudio histórico. actionlint aprobó
el workflow modificado. Este paso no concede aceptación de rendimiento.

## Próxima acción acotada

El bloqueo sigue abierto. Los datos descartan explicar el control independiente
solo por una diferencia Rust, pero no prueban una causa única. Inspeccionar las
fronteras de setup/warmup/realm y los registros originales antes de cambiar
producto o metodología. Una futura medición requeriría evidencia nueva y un
protocolo legítimo; el candidato consumido no autoriza repeticiones ni ajustes
para buscar verde. No hay tag ni merge por este diagnóstico.
