# Calibración pareada de operaciones públicas

Esta prueba compara dos procesos independientes que cargan exactamente la misma
distribución de `checkpoint-065-attribute-reads`. Es un control A/A de precisión;
no mide una mejora del candidato de copia de atributos ni aprueba ese hito.

## Hipótesis y criterio fijados antes de medir

El método anterior produjo diferencias absolutas superiores al 5% en cuatro de
doce filas sin cambiar el motor. La hipótesis nueva es que intercalar muestras
adyacentes, conservar los procesos y ampliar el warmup reduce el sesgo temporal
lo suficiente para evaluar el presupuesto existente.

`plan.json` se escribe antes de iniciar el primer proceso medido. Exige, para las
veinte filas originales, una diferencia absoluta de medianas agrupadas de hasta
2% y una diferencia de hasta 5% en cada pareja independiente de workers. No se
compensan filas entre sí. Estos límites son un control diagnóstico más estricto;
el presupuesto público de regresión sigue siendo +5% contra checkpoint 65.

Se ejecuta primero Node 22. Si falla la precisión, no se repite el candidato A/B
con este protocolo ni se ejecuta Node 24 para intentar obtener una aprobación.
Si pasa, se calibra también Node 24 antes de utilizar el protocolo en candidatos.

## Operaciones y muestreo

- Dos parejas de procesos persistentes y separados por runtime.
- Dieciséis muestras de warmup y treinta y dos medidas por etiqueta y fila.
- Orden `ABBA`/`BAAB`, alternado por bloque y pareja; solo una petición activa.
- Las veinte filas históricas de clonado/importación y controles de atributos y
  FormData, con sus tamaños, entradas y validadores originales.
- Una entrada nueva por operación. El documento conserva `readyState=loading`
  antes de ejecutar la operación, igual que el caso histórico.
- Setup, validación, hash, IPC, GC y cierre quedan fuera del intervalo medido.
- Tras cada operación se exigen endpoints acotados: Window y Document sin
  supervivientes y contadores nativos de vida de vuelta al baseline.

Las muestras crudas conservan warmup, tiempo de pared, CPU aproximada del proceso,
estado del documento, tamaño de entrada, hash de salida y endpoints de liberación.
La CPU puede incluir threads de compilación y no representa exclusivamente el
thread que ejecuta la operación.

## Evidencia y reproducción

`artifacts-before.json` y `artifacts-after.json` identifican fuentes del harness,
test, distribución de referencia y copia local utilizada para validar los
contratos. Deben coincidir. Durante el A/A las dos etiquetas cargan únicamente la
distribución de referencia; su addon debe tener SHA-256
`10ebf630ccc70bf2ac94fec4c4a2e8ba2aaacb90070c4f229dabcde164a96803`.

`run-calibration.cjs` conserva la orquestación exacta del entorno histórico;
`v*-command.json` registra ejecutable, argumentos, directorio, fechas y salida.
Para otro entorno, preparar una distribución inmutable del mismo checkpoint y
usar el Node correspondiente:

```sh
node benchmarks/paired.cjs --first /ruta/checkpoint65 --second /ruta/checkpoint65 --aa --output reports/benchmarks/paired-calibration/local
```

No ejecutar builds, suites, compresión, hashing de fuentes u otras cargas pesadas
durante la medición. La captura de identidades se hace antes y después.

Los contratos del coordinador y la equivalencia de los fixtures están en
`reports/validation/paired-calibration/`. Un fallo de creación de proceso real
debe conservar el error original y cerrar el intento sin esperar un evento
`exit` que puede no emitirse. El cierre usa `close` y no escribe al IPC después
de detectar el fallo inicial.

## Límites

Un solo host WSL2 virtualizado no representa todas las plataformas. Las pruebas
finitas de liberación no demuestran ausencia universal de fugas. La equivalencia
de salidas no demuestra paridad completa con jsdom ni con estándares. Un A/A
aprobado tampoco demuestra una mejora del candidato Rust.

El resultado se publica en `outcome.json` y en los resúmenes por runtime, con
todas las filas que incumplan el criterio. Si falla, conservar las observaciones
y utilizar ese diagnóstico para formular una hipótesis diferente.

## Resultado ejecutado: precisión insuficiente

Node 22.12.0 terminó el 21 de octubre de 2026 a las 10:05 UTC, después de
3.840 observaciones y aproximadamente trece minutos y medio. Las veinte filas
conservaron sus salidas, los endpoints de liberación se alcanzaron y los cuatro
procesos cerraron correctamente. Las identidades anteriores y posteriores son
iguales. Las fuentes medidas, incluidas las del harness, se archivaron y se
verificaron después de extraerlas: SHA-256
`b52929362de55f1c4714aaea3d4cc0b9529dc13c238d5f84b2ccccc2fa7fd634`,
333 archivos, más el test pareado identificado por separado.

El método **no aprobó**: doce filas excedieron 2% en valor absoluto y once
tuvieron alguna pareja por encima de 5%. Cuatro medianas agrupadas excedieron
incluso 5% sin cambio de motor:

| Fila | Diferencia segunda/primera |
| --- | ---: |
| import-template-content / 100 | −7,0795% |
| clone-shallow-template / 100 | −5,6954% |
| clone-shallow-attributes / 1.000 | −5,5724% |
| clone-deep-chain / 1.000 | −5,0157% |

Doce filas invirtieron el signo de la diferencia entre parejas. En 31 de las
40 combinaciones de fila/pareja, alguna etiqueta difirió más de 5% entre las
primeras ocho y las últimas ocho muestras medidas. Por eso el warmup y el
intercalado no demostraron estabilidad suficiente. En las once diferencias
individuales mayores a 5%, la mediana de CPU del proceso varió en el mismo
sentido; ese dato no identifica una causa y no permite atribuir todo al scheduler.
`diagnostics.json` conserva medianas de CPU, warmup, deriva y memoria por etiqueta;
`analyze-calibration.cjs` conserva el cálculo.

No se ejecutó Node 24 bajo este protocolo ni un nuevo candidato A/B, conforme a
la decisión previa. Los contratos sí pasaron en ambos Node. No se modificó el
presupuesto original ni se aprobó la primitiva de atributos. La comparación
anterior tampoco puede declararse mejorada usando distintos conjuntos de filas.

El próximo diagnóstico debe estudiar las diferencias persistentes entre
procesos y la deriva durante la fase medida: compilación/desoptimización, GC y
afinidad/CPU son hipótesis por verificar con trazas separadas. Repetir variantes
de la API nativa con este mismo protocolo no resolvería esa incertidumbre.
