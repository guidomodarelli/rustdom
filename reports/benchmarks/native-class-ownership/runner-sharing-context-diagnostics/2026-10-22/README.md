# Resultado del contraste con contexto completo

La única secuencia declarada terminó: ocho procesos, 128 lotes y 1.152 duraciones
medidas, con exit0 en todos los workers y ambos drivers. Node22 se ejecutó antes
que Node24. El método se publicó y revisó localmente antes de medir en
8cc47053e048c06b39ae93c8ad9fb0eb17f9fc79, huella c5afe557…; la review remota
seguía sin cuota. No se reintentaron casos ni se calculó aceptación de rendimiento.

## Qué permite concluir

La separación del módulo no queda demostrada como solución. La carga focal
range-control-1000/250 conserva estas diferencias primero/segundo, calculadas
como razón entre medianas de nueve muestras dentro de cada proceso:

| Node | Posición | Módulo | Orden | Primero/segundo Δ% |
| --- | ---: | --- | --- | ---: |
| 22.12.0 | 0 | Compartido | B/A | +16,718885 |
| 22.12.0 | 0 | Independiente | B/A | −1,029562 |
| 22.12.0 | 4 | Independiente | A/B | −9,200011 |
| 22.12.0 | 4 | Compartido | A/B | +0,529461 |
| 24.14.1 | 0 | Compartido | B/A | −3,639145 |
| 24.14.1 | 0 | Independiente | B/A | −2,683792 |
| 24.14.1 | 4 | Independiente | A/B | −5,031800 |
| 24.14.1 | 4 | Compartido | A/B | −9,848564 |

Los dos casos no reproducen de forma uniforme el patrón original de C ni
permiten generalizar a las ocho posiciones factoriales. No se presenta una
media entre casos como criterio nuevo. analysis.json conserva las ocho filas,
64 comparaciones por fila/proceso y todas las muestras de ambas etiquetas.

Se conservaron las trazas completas. El analizador observó 4.608 líneas con
el script del workload; ninguna identificó explícitamente measure por nombre
con el filtro declarado. Eso no demuestra ausencia de optimización. Los
marcadores delimitan lotes enteros, incluyendo preparación, warmup, checks y GC;
no ubican eventos dentro del cronómetro ni atribuyen causas a V8/SDK/scheduler.

El resultado es inconcluso respecto de la explicación propuesta. No corresponde
adoptar la separación como fix probado, cambiar el presupuesto anterior, repetir
este contraste o declarar resuelto ownership. Antes de otra medición debe
definirse una hipótesis y método nuevos, considerando el entorno de ejecución
y conservando la procedencia completa de fuentes, compilados y herramientas.

## Integridad y comportamiento

raw.tar.gz conserva 1.366 archivos y 137.155.498 bytes originales: fuentes
congeladas, estados de proceso, entradas/reportes, stdout/stderr V8 completos,
paquetes declarados, hardware y endpoints. method-declaration.json se exportó
después de ejecutar, leyendo únicamente los exports de configuración congelados;
no genera muestras ni cambia la receta. El análisis lo identifica como derivado.

El verificador comprueba hashes de todos los archivos, fuentes y ambos harnesses,
orden ABBA, posiciones0/4, identidad J0/J1, flags, afinidad y cada endpoint.
Los checksums públicos de cada una de las ocho filas coinciden entre etiquetas,
modos, procesos y Nodes. La receta preservó la secuencia completa de ocho filas.

El worker comprobó 1.536 WeakRef por tipo Window/Document, incluyendo warmups.
El análisis recalculó 512 comprobaciones finales por etiqueta con dos endpoints
claros por lote. Solo se ejecutó jsdom27.4.0; no se cargó el addon Rust.
Son observaciones post-GC, no memoria pico ni ausencia universal de fugas.

Python3.10/Linux y Python3.12/Windows produjeron analysis.json idéntico, SHA256
83956f19343db58933db517de4fa825fc9cfb47e2ef891b3d3d851555e9eef20.
Node22 cruzó 128 medianas de lote, 64 comparaciones y las 1.152 muestras contra
los reportes originales, sin generar cargas adicionales. La repetición escalar
desde una extracción nueva aprobó con Node22/24 sin usar los roots originales.
La revisión local de código y datos terminó sin hallazgos.

```sh
python3 -B analyze.py > /ruta/analysis-recalculado.json
# Tras extraer raw.tar.gz en una carpeta nueva:
node verify-math.cjs /ruta/extraida /ruta/analysis-recalculado.json
```

El CI general del método publicado seguía activo al preparar el resultado;
XML39710595698success y ownership39710595756failure en el preflight histórico.
El estudio C anterior conserva accepted=false; este diagnóstico no lo sustituye.
