# Baseline del CLI con declaraciones heredadas

Se ejecutó `npm run inventory -- --output TEMP` completo, con dos procesos de
warmup y cinco medidos por Node 22.12.0 y 24.14.1. Las catorce ejecuciones
terminaron con exit 0 y sus cinco archivos de salida coincidieron con todos
los digests del catálogo validado para ese Node. Se guardan también los warmups.

| Node | Mediana completa | Máximo RSS medido |
| --- | ---: | ---: |
| 22.12.0 | 3.579,10 ms | 207.936 KiB |
| 24.14.1 | 2.893,78 ms | 250.460 KiB |

`2026-10-22-cli.json` conserva muestras, comandos exactos, directorios, versiones,
hardware, recursos GNU time y hashes de las salidas. `raw/` conserva stdout,
stderr y recursos de cada proceso. Las 206 fuentes de entrada coincidieron
antes/después con el manifest de validación. Las versiones npm 11.11.0 y
TypeScript 5.9.3 se registraron al finalizar; no se afirma una revalidación
de todas las herramientas antes y después.

Incluye startup de npm/Node, resolución de referencia, AST, observación de
descriptores, clasificación, serialización y escrituras. Cada proceso es nuevo;
los warmups no vacían la caché de archivos. GNU time mide CPU del comando y
descendientes; su máximo RSS no suma el consumo simultáneo de todos los procesos.

Las fuentes y dependencias DOM/TypeScript están en el filesystem Linux; Node/npm
y sus módulos de soporte están en el disco Windows montado. Ese layout difiere
del baseline histórico. No se calculan mejoras o regresiones a partir de ambos,
ni se fija aquí un presupuesto del motor. No ejecuta el DOM Rust, no mide cruces
N-API y no es una prueba de ausencia de fugas. Cinco muestras por Node en un
solo host son un baseline de tooling, con esos límites.
