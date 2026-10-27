# Calibración desglosada sin repetir la captura

Se conservaron los 2048 procesos, 1024 pares y 64 filas Node/fase/motor/tarea
del run 40137458635. El lector reproduce exactamente las 128 medianas combinadas
del análisis oficial. Siete contratos pasaron en Windows/Python3.12 y
Linux/Python3.10; ambos exports son byteidénticos. La decisión original sigue
rechazada: no se recomputan aceptación, presupuestos ni gate histórico.

La fila AA Rust Node22 range-control-1000/1000 tiene -11,442393% oficial.
Las razones individuales abarcan -29,342345% a +12,880155% y su mediana es
-7,141485%; son tres estadísticas diferentes, no criterios alternativos.
Dentro de cada proceso, la mediana del cambio entre el primer y último bloque
de tres medidas es +22,017353% para A y +5,400308% para B. Ambas son copias del
baseline, no el candidato. La variación temporal merece investigarse; no es
una regresión del candidato, una prueba nueva del gate ni evidencia de una
causa concreta o falta de warmup.

La fila de control jsdom AA Node22 para la misma tarea tiene -4,781618%
oficial. Particionar las razones por orden A/B da medianas -6,351393% y
-5,725595%; invertir el orden no elimina descriptivamente esa diferencia.
Otras filas cambian de signo entre particiones: se publican todas, sin elegir
la partición que pasa. Posición/semilla/factores están ligados; no atribuir a
un paquete físico, orden, CPU, GC o JIT el efecto de esas particiones.

Esto no aporta justificación para repetir la misma secuencia o cambiar el
estimador como arreglo. La incógnita siguiente es qué sucede dentro de range-control,
especialmente en las copias AA: las muestras disponibles no tienen CPU/GC/JIT
por span para esa fila. Si se necesita otra captura, preparar primero un
diagnóstico nuevo y acotado de esa ruta, con candidatos/paquetes identificados,
instrumentación, cantidad y límites fijos; conservar también resultados
desfavorables. La autorización permanente cubre ese trabajo, sin otra pregunta.
No afirmar de antemano qué ajuste solucionará calibración o rendimiento.

El workflow `range-calibration-contracts.yml` ejercita este lector en Linux y
Windows con un timeout de diez minutos; no captura DOM. Actionlint detectó
que `runner` no está disponible en env de job: se declaró el destino temporal
en un paso mediante GITHUB_ENV. Se conservan el diagnóstico inicial y la
validación final del workflow, sin ocultar el fallo de preparación.

`comparisons.md` expone las 64 filas. `linux/` y `windows/` conservan todos los
pares/particiones y los dos exports. `validation/` contiene comandos, logs y
versiones. `constants/inputs.json` fija los tres exports originales; las fuentes
del estudio y su archivo íntegro permanecen intactos. No se ejecuta código
archivado ni DOM, no hay muestras nuevas ni aceptación de ownership.

El código separa lectura/autenticación (`source.py`), métricas descriptivas
(`metrics.py`) y salida a un destino nuevo/disjunto (`run.py`). Los tests usan
los datos reales, comprueban corrupción, protección del destino, cobertura,
reproducción y conservación de las entradas; no mockean plataformas.

Para reproducir con Python3.10 o posterior, desde el repositorio:

```sh
python -B reports/benchmarks/native-class-ownership/range-collapse-calibration/40137458635/test_calibration.py reports/benchmarks/native-class-ownership/range-collapse-study-results/40137458635 -v
python -B reports/benchmarks/native-class-ownership/range-collapse-calibration/40137458635/run.py reports/benchmarks/native-class-ownership/range-collapse-study-results/40137458635 /directorio-nuevo-disjunto
```

Recursos: los archivos se cierran mediante context managers/read_bytes; las
estructuras se limitan al dataset fijo y no hay cache global, callbacks,
Window ni Document nuevos. No se midió memoria pico del lector ni se deriva
ausencia universal de fugas. La evidencia de recursos del DOM sigue siendo
la de reports/memory/range-collapse-study-40137458635.*.
