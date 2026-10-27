# CI general de afba8091

El [run 39735898622](https://github.com/guidomodarelli/rustdom/actions/runs/39735898622)
terminó con éxito sobre `afba8091939ecb99d255053c660feaf55c3b70d7`. Aprobaron
los ocho jobs: Windows/macOS/Linux, cuatro shards y agregador de benchmarks.
`run.json` y `jobs.json` conservan los metadatos originales. Los tres logs de
validación están comprimidos sin cambiar sus bytes; `receipt.json` conserva
hashes de logs crudos y comprimidos.

Este CI valida ese SHA, no commits posteriores. No convierte el tiempo del
job en una métrica DOM ni acepta el presupuesto de ownership. El ensayo
independiente 39735778846 terminó completo y rechazado por calibración del
control; su evidencia se publica por separado. No se omite el gate histórico
negativo ni se crea merge/checkpoint por los ocho checks generales aprobados.
