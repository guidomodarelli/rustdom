# Trayectorias del estudio compartido: análisis descriptivo

Este análisis solo lee la publicación íntegra del run `40012710923` en commit
`7a78034935582c53878320e794c86c90afc1ad1b`. No ejecuta DOM, addon, sampler,
GC ni perfiles y recoge cero mediciones nuevas. El rechazo original permanece
intacto: once controles jsdom inválidos y un exceso numérico del candidato.
No recalibra ni reevalúa el gate con otro estimador.

## Hallazgo y alcance

`mutation-records-collect/100` en Node 22 AB tiene medianas agrupadas A
8.936436 ms y B 9.857362 ms (+10.3053%). El control jsdom también falla
(+2.0665% > ±2%), de modo que no es evidencia causal suficiente de una regresión Rust.

La trayectoria de esta fila presenta oscilaciones también en AA, donde solo se
comparan copias del mismo baseline. En AB, las medianas por índice del candidato
van de 7.022423 a 11.949111 ms; no muestran una meseta constante. Las medianas por
proceso abarcan 7.511365–10.486420 ms en A y 7.931435–11.705912 ms en B.
La misma operación pública conserva los hashes esperados.

Al emparejar descriptivamente las medianas de proceso por las dieciséis semillas,
12 diferencias son positivas y 4 negativas,
con rango -21.1927% a +44.9204%. Estas particiones no sustituyen
la mediana agrupada registrada ni conceden aceptación. Se preservan las 16 semillas,
las nueve posiciones medidas y las tres observaciones de warmup de cada proceso.

Los tiempos no contienen eventos GC/JIT del candidato. Esta forma de la
trayectoria es compatible con varias causas y no identifica por sí sola GC,
compilación, ruido del host ni una función Rust responsable. El diagnóstico CPU/GC/JIT
anterior ejecutó solo jsdom; no puede suplir ese dato faltante del candidato.
No hay fundamento en estos datos para modificar el runtime a ciegas ni para
afirmar que los fixtures compartidos resolvieron la calibración.

## Todas las trayectorias

Se conservan los 2048 procesos y 18432 duraciones medidas en 64 combinaciones
Node/fase/motor/fila, con 128 tratamientos. El lector existente
`current-ownership-diagnostics.cjs` comprueba que cada mediana agrupada y cada
cambio coinciden exactamente con la publicación. Se reusa sin modificarlo.

`Último/primero` compara medianas por índice sobre los mismos 16 procesos.
`Dispersión` es `(máximo/mínimo - 1) × 100` de las 16 medianas de proceso.
Son descripciones de variabilidad; no intervalos de confianza, nuevos gates
ni estimadores de una mejora causal. No se seleccionan solo filas favorables.

| Node | Fase | Motor | Fila | Cambio original | Último/primero A | Último/primero B | Dispersión A | Dispersión B |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| v22.12.0 | AA | jsdom | mutation-records-collect/100 | -0.1899% | -21.74% | -31.82% | 17.21% | 28.64% |
| v22.12.0 | AA | rustdom | mutation-records-collect/100 | -3.5747% | +52.58% | +56.77% | 35.23% | 56.02% |
| v22.12.0 | AA | jsdom | mutation-records-collect/1000 | +1.3893% | +20.37% | +5.60% | 51.05% | 33.60% |
| v22.12.0 | AA | rustdom | mutation-records-collect/1000 | -0.4789% | +0.70% | -1.81% | 6.88% | 7.70% |
| v22.12.0 | AA | jsdom | observer-delivery-records/100 | -0.1866% | +4.53% | -2.82% | 22.53% | 12.86% |
| v22.12.0 | AA | rustdom | observer-delivery-records/100 | -0.3011% | -3.12% | -2.21% | 9.67% | 12.67% |
| v22.12.0 | AA | jsdom | observer-delivery-records/1000 | +0.2100% | +2.13% | +1.61% | 10.52% | 7.91% |
| v22.12.0 | AA | rustdom | observer-delivery-records/1000 | +0.1381% | +2.32% | +1.01% | 5.70% | 8.93% |
| v22.12.0 | AA | jsdom | range-control-1000/1000 | +4.5250% | -15.47% | -3.98% | 90.16% | 46.57% |
| v22.12.0 | AA | rustdom | range-control-1000/1000 | -2.3859% | -0.04% | +5.86% | 21.91% | 15.38% |
| v22.12.0 | AA | jsdom | range-control-1000/250 | -5.0387% | -19.17% | -12.14% | 142.19% | 96.21% |
| v22.12.0 | AA | rustdom | range-control-1000/250 | -0.8819% | +12.61% | +3.43% | 30.26% | 14.77% |
| v22.12.0 | AA | jsdom | range-state-lifecycle-1000/1000 | -7.2777% | +60.83% | +11.27% | 80.44% | 53.67% |
| v22.12.0 | AA | rustdom | range-state-lifecycle-1000/1000 | -1.7605% | +2.83% | -0.27% | 9.10% | 10.06% |
| v22.12.0 | AA | jsdom | range-state-lifecycle-1000/250 | +2.0376% | +26.41% | +13.94% | 43.36% | 50.76% |
| v22.12.0 | AA | rustdom | range-state-lifecycle-1000/250 | +0.1429% | -1.43% | -0.33% | 14.81% | 11.87% |
| v22.12.0 | AB | jsdom | mutation-records-collect/100 | +2.0665% | -19.37% | -25.61% | 28.93% | 30.41% |
| v22.12.0 | AB | rustdom | mutation-records-collect/100 | +10.3053% | +49.26% | +62.40% | 39.61% | 47.59% |
| v22.12.0 | AB | jsdom | mutation-records-collect/1000 | +2.4359% | +4.79% | +5.68% | 35.57% | 48.98% |
| v22.12.0 | AB | rustdom | mutation-records-collect/1000 | -2.2133% | -0.82% | +0.11% | 5.52% | 8.98% |
| v22.12.0 | AB | jsdom | observer-delivery-records/100 | -2.9643% | +4.55% | -2.54% | 20.60% | 24.37% |
| v22.12.0 | AB | rustdom | observer-delivery-records/100 | -0.0900% | +2.51% | -0.33% | 59.88% | 10.83% |
| v22.12.0 | AB | jsdom | observer-delivery-records/1000 | +0.1642% | +3.35% | +1.29% | 7.03% | 11.98% |
| v22.12.0 | AB | rustdom | observer-delivery-records/1000 | -0.1110% | +3.73% | +1.27% | 8.99% | 12.13% |
| v22.12.0 | AB | jsdom | range-control-1000/1000 | +1.2269% | +4.18% | +4.63% | 99.58% | 85.96% |
| v22.12.0 | AB | rustdom | range-control-1000/1000 | -1.4168% | +9.70% | +1.65% | 23.57% | 17.26% |
| v22.12.0 | AB | jsdom | range-control-1000/250 | -1.2879% | -7.44% | -7.94% | 122.23% | 98.76% |
| v22.12.0 | AB | rustdom | range-control-1000/250 | -0.8301% | +3.49% | +6.13% | 37.01% | 31.39% |
| v22.12.0 | AB | jsdom | range-state-lifecycle-1000/1000 | -2.8350% | +25.89% | +34.23% | 81.67% | 75.08% |
| v22.12.0 | AB | rustdom | range-state-lifecycle-1000/1000 | +1.0141% | +5.29% | +0.63% | 13.24% | 6.77% |
| v22.12.0 | AB | jsdom | range-state-lifecycle-1000/250 | +4.4099% | +10.96% | -4.68% | 79.18% | 79.03% |
| v22.12.0 | AB | rustdom | range-state-lifecycle-1000/250 | -0.7816% | -0.42% | -0.69% | 12.83% | 17.75% |
| v24.14.1 | AA | jsdom | mutation-records-collect/100 | +0.2013% | -8.48% | -10.05% | 27.33% | 25.47% |
| v24.14.1 | AA | rustdom | mutation-records-collect/100 | -0.7681% | +0.79% | +0.32% | 7.07% | 12.66% |
| v24.14.1 | AA | jsdom | mutation-records-collect/1000 | +0.3608% | -26.94% | -28.65% | 39.08% | 35.00% |
| v24.14.1 | AA | rustdom | mutation-records-collect/1000 | +0.5012% | +5.15% | +2.90% | 7.90% | 6.71% |
| v24.14.1 | AA | jsdom | observer-delivery-records/100 | +0.1023% | +1.25% | +1.99% | 11.88% | 8.50% |
| v24.14.1 | AA | rustdom | observer-delivery-records/100 | -0.6830% | +4.44% | +0.26% | 9.97% | 9.98% |
| v24.14.1 | AA | jsdom | observer-delivery-records/1000 | +0.2203% | +0.62% | -0.80% | 3.25% | 2.07% |
| v24.14.1 | AA | rustdom | observer-delivery-records/1000 | +0.8238% | -2.74% | +0.89% | 10.98% | 10.81% |
| v24.14.1 | AA | jsdom | range-control-1000/1000 | +0.6659% | -21.59% | -22.73% | 20.33% | 26.14% |
| v24.14.1 | AA | rustdom | range-control-1000/1000 | +3.1706% | +22.06% | +1.25% | 50.36% | 57.52% |
| v24.14.1 | AA | jsdom | range-control-1000/250 | +0.0252% | -10.49% | -0.83% | 20.62% | 26.15% |
| v24.14.1 | AA | rustdom | range-control-1000/250 | -1.3040% | -1.46% | +18.85% | 62.17% | 56.03% |
| v24.14.1 | AA | jsdom | range-state-lifecycle-1000/1000 | -1.5724% | -8.51% | -8.41% | 62.85% | 75.78% |
| v24.14.1 | AA | rustdom | range-state-lifecycle-1000/1000 | -0.0927% | -5.80% | -5.59% | 13.53% | 7.99% |
| v24.14.1 | AA | jsdom | range-state-lifecycle-1000/250 | -9.6347% | +24.20% | -9.00% | 49.75% | 65.67% |
| v24.14.1 | AA | rustdom | range-state-lifecycle-1000/250 | -0.3778% | -6.43% | -11.10% | 16.89% | 16.11% |
| v24.14.1 | AB | jsdom | mutation-records-collect/100 | +1.8914% | -7.08% | -5.20% | 26.30% | 28.57% |
| v24.14.1 | AB | rustdom | mutation-records-collect/100 | +1.5955% | -8.03% | -3.01% | 15.11% | 16.27% |
| v24.14.1 | AB | jsdom | mutation-records-collect/1000 | +1.0804% | -21.97% | -21.35% | 25.55% | 17.92% |
| v24.14.1 | AB | rustdom | mutation-records-collect/1000 | +0.0732% | +4.37% | +2.65% | 7.31% | 5.22% |
| v24.14.1 | AB | jsdom | observer-delivery-records/100 | -0.7165% | -0.31% | +2.60% | 7.82% | 13.17% |
| v24.14.1 | AB | rustdom | observer-delivery-records/100 | -2.5567% | -1.63% | +6.02% | 10.71% | 10.15% |
| v24.14.1 | AB | jsdom | observer-delivery-records/1000 | +0.2285% | -0.38% | -0.34% | 2.70% | 1.49% |
| v24.14.1 | AB | rustdom | observer-delivery-records/1000 | -1.9384% | +3.79% | +3.72% | 6.88% | 10.58% |
| v24.14.1 | AB | jsdom | range-control-1000/1000 | +0.8122% | -21.19% | -18.41% | 14.71% | 16.05% |
| v24.14.1 | AB | rustdom | range-control-1000/1000 | +0.2461% | +22.09% | -2.54% | 58.81% | 62.15% |
| v24.14.1 | AB | jsdom | range-control-1000/250 | +1.0850% | +0.87% | +3.31% | 14.41% | 22.77% |
| v24.14.1 | AB | rustdom | range-control-1000/250 | -3.2844% | +8.75% | -21.31% | 57.79% | 62.52% |
| v24.14.1 | AB | jsdom | range-state-lifecycle-1000/1000 | +0.8231% | -12.78% | -11.11% | 56.12% | 52.18% |
| v24.14.1 | AB | rustdom | range-state-lifecycle-1000/1000 | -1.7982% | -6.81% | -8.81% | 7.33% | 13.93% |
| v24.14.1 | AB | jsdom | range-state-lifecycle-1000/250 | -3.7384% | -13.63% | -13.70% | 64.49% | 38.73% |
| v24.14.1 | AB | rustdom | range-state-lifecycle-1000/250 | -0.0702% | -5.11% | -9.78% | 16.37% | 28.98% |

## Índices de la fila con exceso numérico

Cada posición conserva los 16 procesos, sin recortar extremos:

| Tratamiento | Posición medida | Mediana ms | Mínimo ms | Máximo ms |
| --- | ---: | ---: | ---: | ---: |
| A | 1 | 7.295184 | 6.282722 | 7.523507 |
| A | 2 | 7.151852 | 6.714223 | 12.915502 |
| A | 3 | 11.139847 | 8.251287 | 12.887544 |
| A | 4 | 8.447184 | 6.575950 | 13.004826 |
| A | 5 | 10.853930 | 5.985325 | 12.979419 |
| A | 6 | 7.179894 | 6.393226 | 12.646520 |
| A | 7 | 10.700826 | 8.232515 | 12.850844 |
| A | 8 | 10.129218 | 6.079075 | 12.003627 |
| A | 9 | 10.888966 | 7.636007 | 12.335026 |
| B | 1 | 7.295319 | 6.322286 | 8.156118 |
| B | 2 | 7.022423 | 6.690263 | 11.447370 |
| B | 3 | 11.178536 | 8.081860 | 12.606051 |
| B | 4 | 8.284902 | 6.658145 | 12.578304 |
| B | 5 | 10.673761 | 8.099247 | 12.106843 |
| B | 6 | 8.955288 | 6.307648 | 15.469066 |
| B | 7 | 11.949111 | 7.931435 | 12.961007 |
| B | 8 | 9.231956 | 6.554753 | 12.345430 |
| B | 9 | 11.847317 | 10.203507 | 12.464514 |

## Reproducción, pruebas y límites

`40012710923/trajectories.json.gz` conserva los resultados íntegros; el JSON
descomprimido tiene SHA256
`76167f6d72197415610a1e3f1cd34c2eaf49a0babfcf53ff2218ccd9c02ab51a`.
`inputs.json.gz` es una transcripción de las muestras ya publicadas, incluyendo
6144 warmup, con sus hashes de origen; no es una captura ni muestras añadidas.
Los dos Node fijados producen bytes idénticos tanto de inputs como de resultados.

El entrypoint es `analyze.py`; autentica el manifiesto publicado y sus tres
inputs antes de escribir, valida las cantidades y prohíbe sobrescribir el paquete.
`analyze.cjs` es el adaptador interno al lector estadístico existente y exige
el binario Node fijado; sus inputs deben provenir del entrypoint autenticado.

Desde la raíz del repositorio, con una carpeta de salida nueva fuera del paquete:

```sh
python3 -B reports/benchmarks/native-class-ownership/shared-fixture-study-diagnostics/analyze.py \
  "$PWD" "$PWD/reports/benchmarks/native-class-ownership/shared-fixture-study-results/40012710923" \
  /ruta/a/node-22.12.0/bin/node /tmp/rustdom-shared-trajectories-node22
```

Repetir la lectura con Node 24.14.1 en otro directorio nuevo no ejecuta el estudio.
Seis contratos Python pasan con los datos reales, corrupciones y guards de
Python optimizado/overwrite/symlink; tres contratos por Node ejercen todas las
trayectorias y rechazan posiciones duplicadas y relabel de aceptación.
Los logs completos se guardan en `40012710923/validation/`.

No se cambian los 26 pins ni las 434 fuentes congeladas. Ownership sigue
rechazado; no hay tag ni merge. Sigue faltando evidencia causal suficiente y
una resolución del presupuesto. Cualquier futuro experimento debe registrarse
y autorizarse por separado, sin repetir una secuencia consumida ni cambiar este
resultado. La migración general sigue pendiente y el runtime continúa híbrido.
