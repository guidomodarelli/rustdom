# Control negativo de las regresiones señaladas

Declarado después del resumen completo de Node 22 y antes de ejecutar una
muestra diagnóstica. El protocolo A/B original continúa sin modificaciones;
este control no sustituye sus resultados ni aumenta sus muestras.

Node 22 señaló `range-control-1000/1000`: +9,4097% de tiempo Rust y +0,7927%
en el control jsdom. Las medianas de los procesos Rust son dispersas, por lo
que corresponde comprobar la variación del mismo motor antes de atribuir la
diferencia al guard. Los seis controles jsdom que no calibraron permanecen
identificados como inconclusos.

Cuando termine la ejecución original, para cada Node con al menos una fila
Rust superior a +5% y control jsdom dentro de ±2%, seleccionar todas las familias
de workload que cumplan esa condición. Conservar ambos tamaños del fixture.
No seleccionar familias por mejoras ni por obtener un resultado favorable.

Por Node seleccionado, ejecutar una sola secuencia A B B A B A A B. Ambas
etiquetas cargan la misma referencia inmutable checkpoint 67, binario
`e178142421fa9fc4b3b30525b1fae3d7a6eac8ffb9123711d09fbc915cda1a01`.
Se reutilizan el CLI, los fixtures y el orden de procesos originales, con CPU 2,
tres warmups y nueve muestras por proceso: 72 muestras por motor/etiqueta/fila.
Finalizar las demás cargas locales antes de empezar y conservar todos los
stdout, stderr, JSON, identidades y medianas por proceso.

Aplicar los mismos presupuestos: ±2% en jsdom y ±5% en la referencia Rust.
Un A/A fuera de presupuesto indica que ese host/protocolo no puede resolver
la atribución con ese margen; no convierte el A/B en aprobado. Si calibra,
investigar el coste del candidato mediante perfiles separados y corregir una
regresión reproducible antes del checkpoint. El A/A se ejecuta una sola vez:
no repetir hasta aprobar, filtrar muestras, relajar límites ni presentar una
medición diagnóstica como resolución del problema.
