# Memoria del estudio XML con propiedades nativas

El archivo original 39907233079, Node 24.14.1, conserva un probe separado
de 15 Window y 15 Document: tres ciclos por copia A0/A1/B/J0/J1, observados
por separado, con dos endpoints finales claros y el mismo UUID de preparación.

Los 442 workers rustdom terminan con sesiones XML live=0, references=0 y
cleanupErrors=0. Otros contadores no son cero: xmlParsers.live=1 en todos
ellos. No es evidencia de liberación completa ni de una fuga por sí solo.
El probe observa owners; los workers de rendimiento no hacen una observación
débil de cada Window. RSS/heap/external son snapshots, sin memoria pico ni
prueba universal de ausencia de fugas.

Las pruebas funcionales del mismo código ya publicadas en Node 22/24 incluyen
57 fixtures liberados por motor/Node, errores, reentrancia, serializers
retenidos y release. Son una observación distinta, no un sustituto de las
mediciones de este host. El resultado de rendimiento es accepted=true dentro
del presupuesto XML; no aprueba ownership ni completa la migración.

Crudos, hashes y funcionales originales:
reports/benchmarks/native-class-ownership/xml-native-properties-results/39907233079/.
