# Liberación de owners en el método emparejado

`node22.json` y `node24.json` conservan seis controles por versión: DOM simple
y la operación completa de Range sobre jsdom, A y B, con observadores separados
de Window y Document. `diagnostic.cjs` conserva el código ejecutado y sus paths
locales de procedencia; las copias y sus fingerprints están en el manifest de
validación del método.

En DOM simple, la primera ronda queda clara y la segunda lo confirma. Después
de la operación de Range, la primera aún observa ambos owners; la segunda y
tercera quedan claras en los tres motores y ambas versiones de Node. Los Rust
registran 1.250 asignaciones y 1.250 liberaciones, cero rangos vivos al endpoint.

Esto motivó fijar tres rondas del helper canónico antes de iniciar la medición,
sin cambiar el cuerpo cronometrado ni prolongar la limpieza según tiempos. El
worker conserva todas las rondas y exige dos endpoints claros antes del siguiente
tratamiento. Los contratos completos también comprueban tamaños 250 y 1.000.

El diagnóstico usó una espera acotada con el helper ya existente; el benchmark
usa un número fijo de rondas. No se interpreta retención transitoria como fuga
del SDK ni se afirma ausencia universal de fugas a partir de estos casos.
