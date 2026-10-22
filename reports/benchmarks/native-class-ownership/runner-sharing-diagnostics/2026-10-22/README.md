# Resultado del diagnóstico de módulo compartido

La única secuencia fijada en RUNNER-SHARING-PROTOCOL.md terminó: 32 procesos,
576 duraciones medidas, ambos Node completos y todos los workers con exit0.
Node 22 se ejecutó antes que Node 24. No hubo reintentos ni presupuesto aceptado.
El método se publicó y revisó localmente antes de medir en
4b76fe2a550c3c979e7412fe7400d02e81d0cf3c; la revisión remota seguía sin cuota.

## Resultado y consecuencia

El contraste no aporta evidencia suficiente para cambiar el runner como solución
a la inestabilidad anterior. El brazo compartido tampoco reprodujo el patrón
7/8 del estudio C: el primer lote fue más lento en 4/8 procesos Node22 y 3/8 Node24,
con los mismos conteos en el brazo independiente.

| Node | Módulo de carga | Primer lote más lento | Mediana descriptiva primero/segundo Δ% | Rango Δ% |
| --- | --- | ---: | ---: | ---: |
| 22.12.0 | Compartido | 4/8 | −1,056620 | −23,603818 a +10,470261 |
| 22.12.0 | Independiente | 4/8 | +0,629139 | −14,370269 a +10,587685 |
| 24.14.1 | Compartido | 3/8 | −3,305326 | −15,692390 a +5,128898 |
| 24.14.1 | Independiente | 3/8 | −1,468412 | −6,475254 a +11,708189 |

El delta es la razón de medianas de nueve muestras del primer y segundo lote
de cada proceso. La tabla describe sus ocho deltas; no calcula una decisión de
calibración ni una comparación Rust. Se conservan todas las posiciones y muestras.

Se observaron 32 líneas de traza con el script worker.cjs en shared Node22 y
24 en shared Node24, ninguna en independent. Son eventos de funciones anónimas:
no identifican la función measure ni ubican un evento dentro del cronómetro.
El parser no encontró bailouts con reason "wrong call target" en ninguno de
los 32 stdout. Los demás motivos, funciones y etapas están conservados; el total
de bailouts fue 1.088/1.104 en shared/independent Node22 y 1.817/1.824 en Node24.
Esos conteos no atribuyen causalidad ni prueban ausencia de actividad no trazada.

Esta secuencia usó flags de traza y solo la fila señalada. A diferencia de C,
no ejecutó las otras siete filas antes/después de ella. Esa diferencia de contexto
y la instrumentación impiden usar el contraste para explicar retrospectivamente
el estudio completo. No corresponde adoptar la separación del módulo como fix
demostrado, repetir esta secuencia o reinterpretar los presupuestos anteriores.
El siguiente diagnóstico debe partir del contexto completo y de una hipótesis
nueva comprobable; no se inició otra medición.

## Integridad, comportamiento y recursos

Se verificaron 1.470 archivos crudos: 81.151.560 bytes sin comprimir. raw.tar.gz
conserva logs completos V8/stdout/stderr, estados de procesos, entrada/reporte de
cada worker, paquetes declarados, ambos harnesses, snapshots y hardware.
Las huellas del método y de ambos paquetes se conservan antes/después.
El verificador offline recalcula además las copias del harness, fuentes congeladas,
orden de brazos, asignaciones, flags, afinidad y endpoints de recursos.

Los 64 lotes produjeron el mismo checksum público
3982e737387febd3077d0d4443ecf8c8d94eda18f6c5ad61d6dc4cab6a2290a2.
El worker comprobó 768 observaciones débiles por tipo Window/Document, incluyendo
warmups. Se recalcularon las 256 comprobaciones finales por etiqueta y los
últimos dos endpoints de cada lote estaban claros. Solo se ejecutó jsdom A/A:
no se cargó el addon Rust ni se midieron sus recursos nativos en esta secuencia.

Python3.10/Linux y Python3.12/Windows produjeron analysis.json idéntico, SHA256
7641b5acc32fef7c67a861065a55d3520be4d5d6ab0fe1315535c0bc8783f49c.
Node22 verificó independientemente las 64 medianas de proceso, 576 muestras y
cuatro resúmenes contra los archivos originales. No se ejecutaron nuevas cargas
para esos cálculos. La repetición offline desde una extracción nueva del archivo
también aprobó con Node22/24, sin usar los roots originales ni cargar paquetes DOM.
Son mediciones instrumentadas y endpoints post-GC; no son
rendimiento de producción, memoria pico ni ausencia universal de fugas.

```sh
python3 -B analyze.py > /ruta/analysis-recalculado.json
# Tras extraer raw.tar.gz en una carpeta nueva:
node verify-math.cjs /ruta/extraida /ruta/analysis-recalculado.json
```

El paso de contratos reales del shard2 del CI de 4b76fe2a ya aprobó con la
corrección de quiescencia; el job y el CI general seguían ejecutando benchmarks
al registrar ese estado. El hito de ownership mantiene accepted=false, sin
merge/tag y sin revisión remota nueva.
