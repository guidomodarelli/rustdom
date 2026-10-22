# CI general de 181957b9

El [run 39727951022](https://github.com/guidomodarelli/rustdom/actions/runs/39727951022)
terminó con éxito sobre `181957b92c8a70df082cd0a08da7681c4794a49f`.
Los ocho jobs aprobaron: validación Windows/macOS/Linux, cuatro shards de
benchmarks y agregador. Los metadatos originales están en run.json/jobs.json;
los logs completos de las tres validaciones se conservan comprimidos sin cambios.

Linux completó sus comprobaciones de paquetes en Node 24 y 22 y Memcheck.
La configuración y el resultado de cada paso se conservan en jobs.json; no se
convierte el tiempo total de instalación/compilación/CI en una métrica del DOM.

Este incremento del HEAD registraba el ensayo activo y su revisión publicada;
conserva el arnés de 380 archivos `fc25f0b6…` de `6f708467`. El CI general no
acepta el presupuesto de ownership: el ensayo 39727878290 se evalúa por separado.
El gate histórico sigue negativo y no se omite. No hay merge ni checkpoint
por tener verdes estos ocho jobs.
