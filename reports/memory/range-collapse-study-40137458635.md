# Recursos del estudio de collapse

La secuencia completa conserva 2048 procesos, 24576 Window y 24576 Document
observados por separado, con tres rondas por proceso y 4096 estados finales
claros. Las 253 primeras rondas no claras permanecen en los datos; no se eliminaron
como outliers ni se agregaron rondas. Cada proceso cumplió el predicado nativo
original y dos estados finales claros consecutivos.

Los 18 grupos separan Node/fase/motor/paquete físico. Los grupos Rust observan
baselines de 22 clases nativas y finales de 22, no cero. Para jsdom ese contador
no aplica y se conserva sin fabricar un baseline. Los CSV/JSON y el archivo
íntegro retienen warmup, muestras, snapshots y los baselines de cada proceso.

Los tres snapshots del padre corresponden a before-workers, after-v22.12.0 y
after-v24.14.1. Sus rangos y los de los hijos son observaciones puntuales, no
memoria pico, presión máxima ni prueba universal de ausencia de fugas. No se
infiere causalidad de las diferencias de RSS/heap/external/arrayBuffers.

El replay actual verificó la misma decisión rechazada en ambos Node. Los
17 controles jsdom fuera de presupuesto y la desviación AA Rust se publican
íntegros; estos resultados de recursos no aprueban rendimiento ni reevalúan
los rechazos históricos. No se ejecutó DOM durante extracción o análisis.
La metodología finita no sustituye la migración completa, todavía pendiente.
