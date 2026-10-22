# Comparación completa del candidato C

Secuencia única del método publicado en `eaeca4af3084a23b96fc0214240b552204018c22` y revisado antes de medir.
Recibo remoto: https://github.com/guidomodarelli/rustdom/pull/80#issuecomment-6329498729.
Los 64 procesos finalizaron con exit 0 y produjeron 9.216 duraciones. Ambos drivers
y el launcher terminaron con exit 1 por accepted=false, sin interrupción ni reintentos.
La verificación offline posterior reprodujo exactamente ambos resultados negativos.

C agrega únicamente #[inline] al helper nativo. A es checkpoint067; la etiqueta B
representa C. Los cinco paquetes conservan sus identidades completas. La copia de build
C no tiene Git: su procedencia, inputs, patch, binario y validación están registrados.
Se conservan 357 fuentes por Node, PID independiente de cada proceso, stdout/stderr,
afinidades por hilo, resultados públicos, duraciones y todos los intentos de limpieza.

## Decisión

El presupuesto sigue sin aceptar. Los umbrales (±2% jsdom, ±5% Rust A/A, +5% Rust A/B),
las ocho filas, tres warmups/nueve muestras y medianas agrupadas no se modificaron.
v22.12.0: calibraron 4/8 A/A y 4/8 A/B; 4/8 A/B dentro del presupuesto.
v24.14.1: calibraron 5/8 A/A y 5/8 A/B; 5/8 A/B dentro del presupuesto.

Todas las filas Rust A/A quedaron dentro de ±5%. Los rechazos de calibración de esta
secuencia provienen del control jsdom. Todas las filas Rust A/B calibradas quedaron
dentro de +5%; eso no habilita excluir las filas sin calibración ni aceptar el conjunto.

mutation-records-collect/100 de Node24 registró +0,704117% Rust y −1,302265% jsdom:
su A/A y A/B calibraron y la fila quedó dentro del presupuesto. El exceso del estudio
anterior no apareció en esta comparación A/C; comparar estudios separados no demuestra
causalidad de inline ni una mejora universal.

range-control-1000/1000 de Node24 registró +5,189336% Rust y +3,531075% jsdom A/B.
Se publica el exceso crudo de +5%, pero su control no calibró: no es una regresión
calibrada atribuible a C. Node22 range-control-1000/250 A/A registró −16,542983%
en jsdom, donde C no se ejecuta. Hace falta investigar esa inestabilidad con los
datos completos; no relanzar esta secuencia idéntica ni cambiar su decisión.

No habilita merge/tag ni suma APIs DOM migradas.

## Todas las filas

### v22.12.0

| Fase | Carga/tamaño | Rust Δ% | jsdom Δ% | Calibra | Dentro del presupuesto |
| --- | --- | ---: | ---: | --- | --- |
| AA | mutation-records-collect/100 | -0.193601 | +0.545197 | Sí | Sí |
| AA | mutation-records-collect/1000 | -1.378399 | +0.033080 | Sí | Sí |
| AA | observer-delivery-records/100 | -0.243651 | -6.278118 | No | No |
| AA | observer-delivery-records/1000 | +3.738681 | -0.042161 | Sí | Sí |
| AA | range-control-1000/1000 | -1.310793 | +2.375559 | No | No |
| AA | range-control-1000/250 | +2.105292 | -16.542983 | No | No |
| AA | range-state-lifecycle-1000/1000 | +0.411063 | -6.794801 | No | No |
| AA | range-state-lifecycle-1000/250 | +2.585210 | -1.802236 | Sí | Sí |
| AB | mutation-records-collect/100 | -0.602169 | -3.419620 | No | No |
| AB | mutation-records-collect/1000 | -0.621998 | +0.049417 | Sí | Sí |
| AB | observer-delivery-records/100 | -3.664409 | -1.538943 | Sí | Sí |
| AB | observer-delivery-records/1000 | -0.010483 | +2.268166 | No | No |
| AB | range-control-1000/1000 | -2.703189 | +0.865991 | Sí | Sí |
| AB | range-control-1000/250 | -2.543352 | +12.506767 | No | No |
| AB | range-state-lifecycle-1000/1000 | +1.791277 | +1.709817 | Sí | Sí |
| AB | range-state-lifecycle-1000/250 | -2.420192 | +4.369554 | No | No |

### v24.14.1

| Fase | Carga/tamaño | Rust Δ% | jsdom Δ% | Calibra | Dentro del presupuesto |
| --- | --- | ---: | ---: | --- | --- |
| AA | mutation-records-collect/100 | +1.522987 | +1.651450 | Sí | Sí |
| AA | mutation-records-collect/1000 | -1.259845 | -3.030080 | No | No |
| AA | observer-delivery-records/100 | +1.052914 | -2.964086 | No | No |
| AA | observer-delivery-records/1000 | -2.955208 | +1.964621 | Sí | Sí |
| AA | range-control-1000/1000 | +4.249837 | +0.386928 | Sí | Sí |
| AA | range-control-1000/250 | -0.968534 | +3.976293 | No | No |
| AA | range-state-lifecycle-1000/1000 | +3.198772 | +1.788009 | Sí | Sí |
| AA | range-state-lifecycle-1000/250 | +2.976698 | -0.223319 | Sí | Sí |
| AB | mutation-records-collect/100 | +0.704117 | -1.302265 | Sí | Sí |
| AB | mutation-records-collect/1000 | +0.951976 | +1.526084 | Sí | Sí |
| AB | observer-delivery-records/100 | -0.121158 | -0.983707 | Sí | Sí |
| AB | observer-delivery-records/1000 | -2.995657 | +2.342850 | No | No |
| AB | range-control-1000/1000 | +5.189336 | +3.531075 | No | No |
| AB | range-control-1000/250 | -1.216364 | -2.530126 | No | No |
| AB | range-state-lifecycle-1000/1000 | -2.214659 | -0.199901 | Sí | Sí |
| AB | range-state-lifecycle-1000/250 | +0.490506 | -1.244243 | Sí | Sí |

## Memoria y reproducción

Se observaron 12.288 Window y 12.288 Document distintos. Los 4.096 endpoints finales
requeridos quedaron claros y conservaron los baselines nativos. memory-summary.json
publica rangos posteriores a GC, no picos ni ausencia universal de fugas.

Desde la raíz del repositorio, sin ejecutar cargas:

```sh
node reports/benchmarks/native-class-ownership/paired-inline-experiment.cjs --verify-set reports/benchmarks/native-class-ownership/paired-inline/2026-10-22/node-22 reports/benchmarks/native-class-ownership/paired-inline/2026-10-22/node-24
```

Exit 0 del verificador prueba integridad. accepted sigue false. Los snapshots exactos
del protocolo y sus transitivos están en harness/ de cada Node; no se reinterpreta
el resultado con un estimador o fuentes posteriores.
