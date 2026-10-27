# Comparación pública pareada completa

Secuencia única del método revisado antes de medir, publicada en `3d682ab477992381aba3bf1e4c98b55dbb01d826`.
Recibo remoto: https://github.com/guidomodarelli/rustdom/pull/80#issuecomment-6327932290.
Se completaron 64 procesos y 9.216 duraciones; todos los workers terminaron con exit 0.
Ambos drivers y el launcher finalizaron con exit 1 por `accepted=false`, no por interrupción.

La verificación offline se ejecutó nuevamente después de terminar y reprodujo exactamente todos los resultados.
Se conservan las 350 fuentes congeladas por Node, los paquetes fijados por manifest, stdout/stderr,
máscaras por hilo, muestras, resultados públicos y traces de Window/Document y recursos nativos.

## Resultado

Node 22 calibró 5/8 filas A/A y 4/8 A/B; esas cuatro A/B quedaron dentro del presupuesto.
Node 24 calibró 4/8 A/A y 5/8 A/B; solo cuatro A/B quedaron dentro del presupuesto.
Node 24 mutation-records-collect/100 registró +5,776513% Rust y -1,507971% jsdom en A/B:
la fila A/B calibró y excedió el presupuesto +5%. Su A/A no calibró por el control jsdom +2,737983%.
No basta para atribuir causalidad al SDK; requiere investigar el coste de implementación y no se acepta el hito.

Los umbrales originales (±2% jsdom, ±5% Rust A/A, +5% Rust A/B), las ocho filas,
los lotes de 3 warmups/9 muestras y el estimador de medianas agrupadas permanecen intactos.
No se relanza la secuencia para buscar un resultado favorable ni se selecciona otro estimador.
La asignación física en Rust A/B no es simétrica: B siempre es el candidato; ver protocolo congelado.
No habilita merge/tag y no agrega APIs DOM migradas.

## Todas las filas

### v22.12.0

| Fase | Carga/tamaño | Rust Δ% | jsdom Δ% | Calibra | Dentro del presupuesto |
| --- | --- | ---: | ---: | --- | --- |
| AA | mutation-records-collect/100 | -0.832217 | +1.564557 | Sí | Sí |
| AA | mutation-records-collect/1000 | -1.578061 | -0.964508 | Sí | Sí |
| AA | observer-delivery-records/100 | -3.247474 | -0.915999 | Sí | Sí |
| AA | observer-delivery-records/1000 | -0.706834 | +1.665188 | Sí | Sí |
| AA | range-control-1000/1000 | +7.814333 | +6.014230 | No | No |
| AA | range-control-1000/250 | +0.396994 | +9.621173 | No | No |
| AA | range-state-lifecycle-1000/1000 | -2.181687 | -1.746430 | Sí | Sí |
| AA | range-state-lifecycle-1000/250 | -1.440024 | +4.301412 | No | No |
| AB | mutation-records-collect/100 | -0.298009 | -0.121031 | Sí | Sí |
| AB | mutation-records-collect/1000 | +0.568140 | +2.582616 | No | No |
| AB | observer-delivery-records/100 | -1.868206 | +4.282126 | No | No |
| AB | observer-delivery-records/1000 | -1.289036 | -1.197825 | Sí | Sí |
| AB | range-control-1000/1000 | -3.453066 | +3.502543 | No | No |
| AB | range-control-1000/250 | -6.208643 | +4.381191 | No | No |
| AB | range-state-lifecycle-1000/1000 | -0.933826 | -0.426127 | Sí | Sí |
| AB | range-state-lifecycle-1000/250 | -2.874877 | +0.747293 | Sí | Sí |

### v24.14.1

| Fase | Carga/tamaño | Rust Δ% | jsdom Δ% | Calibra | Dentro del presupuesto |
| --- | --- | ---: | ---: | --- | --- |
| AA | mutation-records-collect/100 | +0.288796 | +2.737983 | No | No |
| AA | mutation-records-collect/1000 | +0.782393 | -0.309086 | Sí | Sí |
| AA | observer-delivery-records/100 | +3.220125 | -0.929160 | Sí | Sí |
| AA | observer-delivery-records/1000 | -3.135385 | +3.303517 | No | No |
| AA | range-control-1000/1000 | +1.940801 | -5.041094 | No | No |
| AA | range-control-1000/250 | -2.522427 | +0.392538 | Sí | Sí |
| AA | range-state-lifecycle-1000/1000 | +0.592851 | +0.986068 | Sí | Sí |
| AA | range-state-lifecycle-1000/250 | +3.189069 | +2.039780 | No | No |
| AB | mutation-records-collect/100 | +5.776513 | -1.507971 | Sí | No |
| AB | mutation-records-collect/1000 | +0.574244 | +0.061736 | Sí | Sí |
| AB | observer-delivery-records/100 | +2.262959 | -0.545088 | Sí | Sí |
| AB | observer-delivery-records/1000 | +2.873123 | +0.763860 | Sí | Sí |
| AB | range-control-1000/1000 | -0.949908 | +6.021150 | No | No |
| AB | range-control-1000/250 | +3.089364 | -2.839224 | No | No |
| AB | range-state-lifecycle-1000/1000 | +3.466334 | -2.570841 | No | No |
| AB | range-state-lifecycle-1000/250 | +2.811835 | -0.730988 | Sí | Sí |

## Memoria y reproducción

Se observaron 12,288 Window y 12,288 Document mediante referencias débiles distintas.
Los últimos dos endpoints de cada lote comprobaron cero supervivientes y los contadores nativos iniciales.
memory-summary.json conserva los rangos posteriores a GC; no son picos ni prueba universal de ausencia de fugas.
Los reportes crudos conservan también los intentos iniciales y todo el detalle de recursos.

Desde la raíz del repositorio, sin ejecutar cargas:

```sh
node reports/benchmarks/native-class-ownership/paired-main-experiment.cjs --verify-set reports/benchmarks/native-class-ownership/paired-main/2026-10-21/node-22 reports/benchmarks/native-class-ownership/paired-main/2026-10-21/node-24
```

Exit 0 del verificador acredita integridad; el campo accepted permanece false.
El protocolo revisado y sus tests exactos están en harness/ de cada Node, sin reinterpretar fuentes posteriores.
