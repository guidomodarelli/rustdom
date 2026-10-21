# Diagnóstico siguiente: aislamiento por fila

Se declara después de que A/A mixto de Node 22 falló en dos filas, sin cambiar
el motor: `xml-document-serialize/100` (+2,027%) y
`xml-serializer-getter-error/1` (+4,302%). No se ejecutó su A/B y no se atribuye
esa diferencia al controlador nuevo. La primera medición de Node 24 todavía
está en curso al declarar este diagnóstico.

Hipótesis: un proceso que recorre trece filas acumula perfiles del JIT,
asignaciones y tareas de documentos anteriores. Además, las etiquetas de una
fila quedan separadas por el trabajo de las otras doce. El patrón de deriva y
variación entre procesos observado justifica probar el aislamiento; todavía no
demuestra que ese sea el origen del ruido. La revisión de los ocho procesos
confirma 33.165 nodos nativos vivos y cero liberaciones al finalizar la pasada,
con referencias temporales XML en cero: existe acumulación entre filas antes de
GC, sin demostrar una fuga. Cada pasada tarda aproximadamente 30–32 segundos.

La única modificación experimental será ejecutar **una fila por proceso** y
completar `A B B A B A A B` de esa fila antes de la siguiente. Se conservan todas
las trece filas, sus fixtures, CPU 2, versiones, 16 batches de warmup, 32 medidos,
64/16/4/1 llamadas por batch, 128 muestras por etiqueta y gates de A/A ±2% y A/B
+5% por fila. No se modifican Node/V8, flags de JIT, frecuencia del host ni límites
de regresión. Cada proceso carga el motor real y mide la operación pública.

El piloto comienza por las trece filas de Node 22. Si su A/A no calibra, se
detiene ese protocolo: no se repiten A/B, comparación descriptiva ni Node 24 con
un método que todavía falla. Node 24 permanece pendiente de aceptación; las
pruebas funcionales de ambas versiones ya pasaron. Si Node 22 calibra, se ejecutan
su A/B y referencia, y el protocolo completo de Node 24.

Los datos originales y sus fuentes se conservan. El segundo protocolo tendrá
otro directorio y otra identidad de harness. A/B solo se habilitará si todas las
filas del A/A correspondiente calibran. La comparación con jsdom sigue siendo
descriptiva. No compensar filas fallidas con otras ni seleccionar solo las que
calibraron; no presentar una ejecución incompleta como aceptación.

## Resultado del piloto

Completó 104 procesos en Node 22, ocho por cada una de las trece filas, con 128
muestras medidas por etiqueta y fila. Los hashes completos coincidieron y las
referencias temporales XML finalizaron en cero. A/A no calibró: doce filas están
dentro de ±2%, pero `xml-serializer-getter-error/1` dio −4,891%. Su diferencia
cambió de signo respecto al protocolo mixto sin cambiar el motor; no acredita
una mejora ni una regresión del candidato.

La fila todavía presenta un spread de medianas entre procesos de 25,48% y una
deriva absoluta máxima entre mitades de 21,62%. Se omitieron A/B, nueva referencia
y Node 24, como se declaró antes de medir. Los datos están en
`row-isolated/v22.12.0/`; el motor sigue sin aceptación de rendimiento.

Próximo diagnóstico: observar GC, tiering/deopt y tiempo CPU frente a tiempo
transcurrido de esa fila. No seguir aumentando repeticiones ni modificar el
controlador para perseguir una diferencia que también aparece en A/A. Cualquier
protocolo posterior debe volver a declarar y conservar todas las filas y gates.
