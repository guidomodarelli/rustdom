# Trayectorias de las nueve muestras registradas

Análisis offline de todos los 1.024 lotes y 9.216 tiempos del estudio C completo.
Primero verifica sus 931 archivos y reproduce las medianas originales mediante
el analizador de orden ya publicado. Después describe las primeras, centrales
y últimas tres muestras de cada lote. No ejecuta cargas, elimina muestras,
reevalúa gates ni sustituye el estimador original.

## Caso que condiciona el próximo diagnóstico

En jsdom Node22 A/A range-control-1000/250, el estudio original conserva
−16,542983% B/A y falta de calibración. El primer lote fue más lento que el
segundo en siete de ocho procesos. La comparación dentro de cada lote da:

| Orden del lote | Primer tercio más lento que el último | Mediana primero/último Δ% | Rango Δ% | Mediana máximo/mínimo Δ% |
| --- | ---: | ---: | ---: | ---: |
| Primero | 6/8 | +5,269491 | −3,885619 a +14,560297 | +64,098006 |
| Segundo | 4/8 | +0,094076 | −6,896968 a +80,696323 | +68,838065 |

La razón primero/último compara dos medianas de tres muestras del mismo lote.
La comparación máximo/mínimo conserva también las observaciones extremas.
Son descripciones diferentes de la razón entre medianas de nueve muestras de
dos lotes: no se restan estas estadísticas para explicar el patrón anterior.

Hay variación dentro de los lotes y entre ellos. Los warmups no están registrados;
estos datos no demuestran que tres warmups sean suficientes o insuficientes,
ni identifican JIT, GC, scheduler o un efecto del guard Rust como causa.

El contraste aislado posterior no reprodujo el patrón y omitía las demás filas.
Eso motiva observar el contexto completo, sin adoptar todavía la separación del
módulo como fix. La receta prospectiva nueva conserva las ocho filas en dos casos
históricos que mantienen física/carga y cambian el orden de lotes. No se inició
esa nueva secuencia al preparar este análisis.

## Cobertura y reproducción

analysis.json conserva las 64 combinaciones Node/fase/motor/fila, los 1.024 lotes,
sus muestras originales, sus enlaces al reporte, medianas y los 128 resúmenes
por orden. Las decisiones originales se mantienen; no se usan tercios para aceptar.

Python3.10/Linux y Python3.12/Windows produjeron JSON idéntico, SHA256
5570184d14864fc0ebdcceab6ca487094c651970d8c0cfde2d0e50793b4a3552.
Node22 verificó independientemente 1.024 medianas de lote, 3.072 medianas de
tercios, 128 resúmenes y los 9.216 valores contra los reportes originales.

```sh
python3 -B analyze.py /ruta/analysis-recalculado.json
node verify-math.cjs
```

verify-math.cjs comprueba el analysis.json conservado junto al script. Las
submuestras dentro de un proceso no se presentan como procesos independientes
ni intervalos de confianza. No se obtuvieron nuevas observaciones de memoria.
