# Coste aislado del class return real

El protocolo se declaró en `NATIVE-COPY-PROTOCOL.md` antes de medir. Se ejecutó
una vez: A/A y A/B con dieciséis procesos por fase, en Node 22.12.0/CPU 2. Cada
etiqueta conserva 72 muestras medidas en ocho procesos independientes.

Cada muestra crea y retiene 10.000 `NativeRange.copy` reales del addon. Valida
todos los endpoints y tipos fuera del tiempo, muta una copia para comprobar
independencia y exige liberar todas las copias tras dos ciclos fijos de GC/turno.
Las 3.840.000 copias, incluidos warmups, pasaron esos controles. Los contadores
vuelven al nivel inicial después de cada muestra; la fuente permanece utilizable.

| Fase | A, mediana por 10.000 (ms) | B, mediana por 10.000 (ms) | Variación |
| --- | ---: | ---: | ---: |
| A/A, misma referencia | 6,87256 | 7,01634 | +2,0921% |
| A/B, referencia y guard | 6,94739 | 6,81756 | −1,8688% |

El control A/A cumple ±5% y A/B no señala una degradación >5% en este
microdiagnóstico. No se demuestra una aceleración: la diferencia es pequeña
frente a la variación del control. Los arrays se preparan antes del cronómetro;
el tiempo incluye las copias, los wrappers N-API, sus asignaciones y el almacenamiento
de los resultados. Incluye cualquier GC durante esa operación.

El resultado no reproduce una penalización en el camino del SDK aislado. No
prueba ausencia de regresiones en el Range público: excluye WebIDL, factories
DOM, realms y runners. El A/B público original y sus controles inconclusos se
conservan. Los datos crudos y medianas por proceso están en `index.json` y los
32 reportes; el manifest y el verificador cubren muestras y liberaciones.
