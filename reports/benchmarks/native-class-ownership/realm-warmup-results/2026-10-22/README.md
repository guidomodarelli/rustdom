# Ensayo de operaciones calientes: completo, rechazado

La única secuencia del método publicado en `4a57f334` terminó. Node22 y Node24
completaron 128 workers cada uno, todos con exit0; los drivers de cada versión
terminaron con exit1 por presupuesto. La verificación offline terminó con exit0:
`verified=true`, **`accepted=false`**. No confundir integridad con aceptación.

Se conservan las ocho cargas, fases A/A y A/B, 16 procesos por label/engine/fase,
tres warmups exteriores y nueve muestras medidas por carga. Son 18.432
duraciones medidas, 24.576 Window y 24.576 Document incluyendo 6.144 warmups
exteriores por tipo. Las tres rondas internas calientan operaciones en la misma
ventana, fuera del reloj; esta medición no representa el costo de primer uso.

El estimador declarado sigue siendo la mediana agrupada. No se cambian los
límites: control jsdom ±2%, Rust A/A ±5%, Rust A/B hasta +5%. Las 32 filas
agregadas y todas las muestras están preservadas. Los puntos Rust cumplen;
once controles jsdom incumplen, cinco en Node22 y seis en Node24. Eso impide
aceptar el ensayo completo. `summary.json` enumera todas las filas y rechazos;
`verification.json` conserva también medianas de cada proceso.

`study.tar.gz` conserva íntegra la raíz original, incluidos los tres snapshots
del arnés, 256 informes de worker, stdout/stderr, índices, datos de memoria,
publicación autenticada y procedencia. `archive.json` enumera y autentica todos
los miembros y registra la lectura completa del tar comparada con los originales.
`driver.py` y `start-marker.json` documentan el lanzamiento consumido; no volver
a ejecutarlos. Las fuentes son las 397 publicadas, SHA del arnés
`b15e11dc3ccd88137a3a2e10a8274429107920f235ae32e8ca07468fa5390202`.
La preparación v1 original está fijada por la receta incluida, no por el nuevo
productor v2. No se repitió la captura de optimización ni se perfiló este ensayo.

Para verificar offline, extraer en una carpeta nueva y ejecutar únicamente:

```sh
node harness/reports/benchmarks/native-class-ownership/realm-warmup-experiment.cjs --verify-set node-22 node-24
```

Ese comando autentica crudos y recalcula el mismo estimador; no ejecuta workers
ni mide DOM. Conservar el rechazo, sin quitar filas, cambiar estimador después
de ver los datos o repetir una ejecución idéntica buscando otro resultado.

Las últimas dos observaciones de cada lote quedaron sin Window/Document vivos.
Los rangos de heap, memoria externa y RSS se publican en
`reports/memory/native-class-ownership/realm-warmup-results.json`. Son muestras
tras cleanup, no memoria pico ni demostración de ausencia absoluta de fugas.
Los logs de optimización anteriores no alinean eventos y temporizadores: no
permiten atribuir causalmente la variación a V8, GC o hardware.

No hay aceptación, merge, tag ni crédito de migración Rust. La corrección del
productor de CI es un avance separado y no convierte estos tiempos en válidos.
