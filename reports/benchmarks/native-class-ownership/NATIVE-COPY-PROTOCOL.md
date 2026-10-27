# Aislamiento del camino class-return del SDK

Los perfiles de la operación pública muestran compilación de fondo de V8
superpuesta en 69/72 muestras medidas y ningún GC dentro de esos intervalos.
No demuestran qué cambio causó el +9,41% original. Este diagnóstico mide
directamente `NativeRange.copy`, consumidor real del helper modificado, para
separar el coste de crear su wrapper del de las factories DOM por realm.

Node 22.12.0, CPU 2. Primero un A/A y luego un A/B, cada uno con dieciséis
bloques: A B B A B A A B, repetido dos veces. A/A carga checkpoint 67 en ambas
etiquetas. A/B carga esa referencia en A y el candidato validado en B. Cada
bloque es un proceso independiente, tres warmups y nueve muestras: 72 muestras
por fase/etiqueta. Se ejecuta una sola vez, sin extender o filtrar la corrida.

Cada muestra cronometra 10.000 copias retenidas en un Array preparado antes de
medir. Fuera del cronómetro se verifican el tipo, todos los endpoints, la
independencia de una copia mutada y los contadores de creación/liberación. Se
liberan las copias mediante dos ciclos fijos de turno/GC/turno y se exige volver
al número de objetos vivos inicial. La fuente original permanece utilizable.
Se conservan warmups, muestras, contadores, stderr y versiones/binaries.

El control A/A usa ±5%; A/B señala un aumento >5% para investigar. Son límites
del microdiagnóstico: no aprueban la fila pública ni miden WebIDL, factories de
realm, DOM, Jest, Vitest o jsdom. La GC que ocurra durante la creación forma
parte del coste observado. Un resultado inconcluso se publica como tal.
