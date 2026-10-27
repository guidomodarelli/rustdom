# Variación por proceso y por orden en el estudio archivado

Este análisis posterior usa exclusivamente las 9.216 duraciones del estudio
main-affinity-public-v2 ya publicado en 21706250. No genera muestras, filtra
outliers, cambia el estimador original o reevalúa gates. El resultado original
sigue accepted=false en ambos Node. Los hashes de los dos índices enlazan
cada cálculo con su entrada; el analizador primero verifica el archivo completo.

Cada etiqueta/motor/fila contiene ocho procesos y 72 duraciones. El reporte
conserva sus medianas por proceso, mínimos/máximos de esas medianas y la
mediana agrupada original. Tener 72 duraciones no equivale a 72 procesos;
aquí tampoco se afirma independencia entre procesos ni precisión poblacional.

Las dos mitades del orden A B B A | B A A B conservan cuatro procesos de
cada etiqueta y motor, 36 duraciones por etiqueta. Los cuatro pares de bloques
adyacentes AB, BA, BA, AB conservan dos procesos y 18 duraciones por etiqueta.
Son particiones completas y equilibradas de los mismos datos, examinadas
después de medir. No son experimentos nuevos, intervalos de confianza ni
estimadores alternativos para aceptar resultados más favorables.

## Hallazgos que condicionan la próxima medición

- Node 22 mutation-records-collect/100 Rust A/B conserva +5,057644% original;
  las mitades dan +6,870589% y +1,425339%. Los pares van de -1,425223% a
  +7,418784%. No se usa la mitad favorable para aprobar la fila.
- Node 22 Range/1000 control jsdom A/B conserva +6,334907%; las mitades
  dan +14,312749% y -1,065091%. El mismo control cambia de signo entre
  mitades. No se identifica la causa ni se demuestra un efecto del SDK.

Antes de otro experimento hace falta distinguir la variación entre procesos
de los efectos del tratamiento y declarar un diseño que pueda comprobarlo.
Estos números motivan esa pregunta; no justifican cambiar umbrales, excluir
filas, aumentar muestras hasta aprobar o atribuir la variación a JIT/scheduler.
No se repite la secuencia v2. La corrección y el hito siguen pendientes de
resolver el presupuesto con evidencia adecuada.

## Todas las filas del diagnóstico

| Node | Fase | Carga/tamaño | Motor | Original Δ% | Mitad 1 Δ% | Mitad 2 Δ% | Mín. par Δ% | Máx. par Δ% |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| v22.12.0 | AA | mutation-records-collect/100 | jsdom | +3.377621 | +7.331102 | -1.291368 | -1.927617 | +23.822512 |
| v22.12.0 | AA | mutation-records-collect/100 | rustdom | -5.585548 | -2.940390 | -7.742423 | -10.261503 | +9.901094 |
| v22.12.0 | AA | mutation-records-collect/1000 | jsdom | -2.980525 | -0.956449 | -3.367828 | -4.760179 | +1.234127 |
| v22.12.0 | AA | mutation-records-collect/1000 | rustdom | -0.849087 | +1.874706 | -4.391650 | -4.781401 | +5.445157 |
| v22.12.0 | AA | observer-delivery-records/100 | jsdom | +5.236566 | -3.668313 | +14.031769 | -5.312951 | +11.547314 |
| v22.12.0 | AA | observer-delivery-records/100 | rustdom | +0.732327 | +1.940086 | +1.128871 | -4.128663 | +7.198578 |
| v22.12.0 | AA | observer-delivery-records/1000 | jsdom | +1.397227 | +1.294740 | +2.162976 | +0.388567 | +3.122381 |
| v22.12.0 | AA | observer-delivery-records/1000 | rustdom | -0.034864 | +3.191449 | -1.145948 | -2.247225 | +4.875286 |
| v22.12.0 | AA | range-control-1000/1000 | jsdom | +9.137977 | +11.517123 | +15.968593 | -5.445625 | +19.658328 |
| v22.12.0 | AA | range-control-1000/1000 | rustdom | +5.491200 | +9.398094 | +0.412720 | -5.905696 | +20.161816 |
| v22.12.0 | AA | range-control-1000/250 | jsdom | -0.585687 | +3.367476 | -1.624273 | -5.554962 | +3.241936 |
| v22.12.0 | AA | range-control-1000/250 | rustdom | +0.502951 | +5.187368 | -6.357687 | -9.862362 | +5.442696 |
| v22.12.0 | AA | range-state-lifecycle-1000/1000 | jsdom | +0.493064 | -0.778240 | +0.767214 | -4.502652 | +8.437685 |
| v22.12.0 | AA | range-state-lifecycle-1000/1000 | rustdom | +1.161042 | +3.733972 | -2.827303 | -1.506256 | +8.729776 |
| v22.12.0 | AA | range-state-lifecycle-1000/250 | jsdom | +2.959060 | +5.202744 | +3.122074 | +0.272219 | +3.910541 |
| v22.12.0 | AA | range-state-lifecycle-1000/250 | rustdom | -4.696976 | -4.222151 | -5.265742 | -5.841575 | -1.823167 |
| v22.12.0 | AB | mutation-records-collect/100 | jsdom | +0.166349 | +1.079665 | -0.753813 | -4.696182 | +3.091501 |
| v22.12.0 | AB | mutation-records-collect/100 | rustdom | +5.057644 | +6.870589 | +1.425339 | -1.425223 | +7.418784 |
| v22.12.0 | AB | mutation-records-collect/1000 | jsdom | -1.538399 | -5.377454 | -0.028041 | -12.634398 | +5.141328 |
| v22.12.0 | AB | mutation-records-collect/1000 | rustdom | +1.988767 | +3.696882 | +0.991248 | +0.942026 | +4.597743 |
| v22.12.0 | AB | observer-delivery-records/100 | jsdom | -3.126741 | +1.154718 | -7.507403 | -7.762217 | +7.152850 |
| v22.12.0 | AB | observer-delivery-records/100 | rustdom | -1.861687 | -3.454336 | +0.689295 | -6.682556 | +1.546032 |
| v22.12.0 | AB | observer-delivery-records/1000 | jsdom | +1.330936 | +3.427919 | +0.159338 | -0.758194 | +6.894321 |
| v22.12.0 | AB | observer-delivery-records/1000 | rustdom | -5.353726 | -5.462789 | -6.005523 | -10.178879 | -3.653826 |
| v22.12.0 | AB | range-control-1000/1000 | jsdom | +6.334907 | +14.312749 | -1.065091 | -6.556561 | +15.053277 |
| v22.12.0 | AB | range-control-1000/1000 | rustdom | -1.267075 | +0.535534 | -2.772834 | -4.219063 | +2.484433 |
| v22.12.0 | AB | range-control-1000/250 | jsdom | -9.347524 | -12.660337 | -6.993106 | -17.146772 | -5.315774 |
| v22.12.0 | AB | range-control-1000/250 | rustdom | -2.064181 | -1.683045 | -2.017750 | -8.633332 | +1.093342 |
| v22.12.0 | AB | range-state-lifecycle-1000/1000 | jsdom | -4.032713 | -5.515774 | -3.029559 | -9.630694 | +13.156328 |
| v22.12.0 | AB | range-state-lifecycle-1000/1000 | rustdom | -0.357612 | +0.180492 | -1.305513 | -4.595961 | +4.425900 |
| v22.12.0 | AB | range-state-lifecycle-1000/250 | jsdom | +1.164987 | +0.456963 | +0.397154 | -2.089536 | +1.672298 |
| v22.12.0 | AB | range-state-lifecycle-1000/250 | rustdom | +2.962412 | +2.868136 | +2.676283 | +1.799433 | +6.381846 |
| v24.14.1 | AA | mutation-records-collect/100 | jsdom | +2.258779 | +1.321056 | +6.125939 | +0.769668 | +6.318347 |
| v24.14.1 | AA | mutation-records-collect/100 | rustdom | -1.270488 | +0.660508 | -2.841438 | -3.246191 | +1.442350 |
| v24.14.1 | AA | mutation-records-collect/1000 | jsdom | +0.720686 | -1.382170 | -1.403255 | -4.726710 | +2.733617 |
| v24.14.1 | AA | mutation-records-collect/1000 | rustdom | -1.210476 | -3.926958 | +1.800518 | -3.530274 | +4.913606 |
| v24.14.1 | AA | observer-delivery-records/100 | jsdom | -2.405360 | -0.701601 | -6.041354 | -8.701856 | -0.609610 |
| v24.14.1 | AA | observer-delivery-records/100 | rustdom | +3.713065 | +5.639549 | +2.467054 | -1.374355 | +7.851159 |
| v24.14.1 | AA | observer-delivery-records/1000 | jsdom | +1.774381 | -0.288823 | +5.241435 | -1.331246 | +8.463916 |
| v24.14.1 | AA | observer-delivery-records/1000 | rustdom | -1.289512 | -3.049030 | +1.049633 | -3.852112 | +4.458860 |
| v24.14.1 | AA | range-control-1000/1000 | jsdom | +2.838061 | +2.573204 | +2.792245 | +0.648180 | +4.731044 |
| v24.14.1 | AA | range-control-1000/1000 | rustdom | -0.538384 | -0.623452 | +1.018298 | -6.135076 | +6.919256 |
| v24.14.1 | AA | range-control-1000/250 | jsdom | +1.191096 | +1.406430 | +0.471855 | -2.231291 | +6.123263 |
| v24.14.1 | AA | range-control-1000/250 | rustdom | -0.071837 | -0.304128 | -0.311435 | -7.348091 | +4.602708 |
| v24.14.1 | AA | range-state-lifecycle-1000/1000 | jsdom | +1.000916 | -0.380135 | +2.363319 | -2.308393 | +2.607525 |
| v24.14.1 | AA | range-state-lifecycle-1000/1000 | rustdom | +1.387914 | +4.306750 | -4.679528 | -5.608757 | +5.317889 |
| v24.14.1 | AA | range-state-lifecycle-1000/250 | jsdom | -0.459582 | +0.367294 | -0.272167 | -1.780428 | +3.743425 |
| v24.14.1 | AA | range-state-lifecycle-1000/250 | rustdom | +2.156519 | +3.193598 | +0.651649 | -4.776816 | +5.731575 |
| v24.14.1 | AB | mutation-records-collect/100 | jsdom | +1.474716 | +3.968286 | -2.185469 | -8.245968 | +11.234686 |
| v24.14.1 | AB | mutation-records-collect/100 | rustdom | +0.826908 | +2.346745 | +1.384815 | +1.392755 | +3.402135 |
| v24.14.1 | AB | mutation-records-collect/1000 | jsdom | -2.902357 | -1.838799 | -1.349915 | -6.866249 | +4.720655 |
| v24.14.1 | AB | mutation-records-collect/1000 | rustdom | +0.706107 | -1.560798 | +3.217948 | -6.092878 | +6.270197 |
| v24.14.1 | AB | observer-delivery-records/100 | jsdom | -1.098792 | -3.378357 | +1.631139 | -4.082030 | +0.175547 |
| v24.14.1 | AB | observer-delivery-records/100 | rustdom | +3.482783 | +3.945200 | +3.682089 | -2.679832 | +3.776823 |
| v24.14.1 | AB | observer-delivery-records/1000 | jsdom | -2.299302 | -3.895035 | -1.299818 | -4.475330 | +2.563042 |
| v24.14.1 | AB | observer-delivery-records/1000 | rustdom | +0.094749 | +0.012084 | +0.001206 | -3.979642 | +5.096924 |
| v24.14.1 | AB | range-control-1000/1000 | jsdom | +3.908882 | +5.867795 | +1.386422 | +0.260229 | +5.548124 |
| v24.14.1 | AB | range-control-1000/1000 | rustdom | +2.192366 | +3.107953 | +1.573363 | -0.590102 | +6.000780 |
| v24.14.1 | AB | range-control-1000/250 | jsdom | +2.402105 | +4.040928 | -1.881619 | -2.603947 | +4.587769 |
| v24.14.1 | AB | range-control-1000/250 | rustdom | +1.213805 | +1.817534 | +2.591714 | -1.577705 | +5.548332 |
| v24.14.1 | AB | range-state-lifecycle-1000/1000 | jsdom | +2.547632 | +2.658721 | +2.744765 | -1.716821 | +3.879167 |
| v24.14.1 | AB | range-state-lifecycle-1000/1000 | rustdom | +1.733484 | +2.680514 | +0.383078 | -8.073740 | +8.769517 |
| v24.14.1 | AB | range-state-lifecycle-1000/250 | jsdom | -1.674395 | -0.122751 | -2.168808 | -4.880515 | +1.261531 |
| v24.14.1 | AB | range-state-lifecycle-1000/250 | rustdom | -0.555178 | +4.196885 | -4.697393 | -4.833887 | +7.067923 |

## Reproducción y límites

`node reports/benchmarks/native-class-ownership/main-affinity-precision.cjs`
recalcula las 64 filas desde los archivos originales. El spec correspondiente
ejercita datos reales, el CLI, los conteos, el rechazo de alcance incompleto
y la propiedad independiente de los resultados. Seis pruebas pasaron en
Node 22.12.0 y 24.14.1. No se ejecutan DOM, addon, runners o timings nuevos.

El analizador retiene únicamente datos escalares/arrays acotados al archivo
local durante la llamada. No agrega N-API, listeners, timers o caches mutables
globales. Esto no es una nueva prueba de ausencia de fugas del DOM.
No se migran APIs de plataforma ni se completa una fase del objetivo integral.
