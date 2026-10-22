# Contratos del diagnóstico de contexto completo

Cuatro tests aprobaron por Linux Node22.12.0/24.14.1, sin skips ni fallos.
Ejercitan dos workers completos por Node y conservan dos workers del modo
aislado anterior para comprobar que sus defaults no cambian.

El plan nuevo conserva cuatro procesos por Node, ABBA de modos y posiciones
0/4. Cada worker completo ejecuta las ocho filas y 16 lotes públicos originales.
La integración usa roots relativos y paquetes jsdom27.4.0 reales; comprueba
checksums de todas las filas, no solo de la primera. La corrupción de una fila
tardía y la retención declarada falsamente como libre se rechazan.

La validación funcional produjo ocho workers, 72 lotes y 648 duraciones:
576 del contexto completo y 72 de los defaults aislados. No se interpretan
sus tiempos como la secuencia diagnóstica prospectiva, que todavía no se ejecutó.
El worker comprobó 864 WeakRef por tipo Window/Document, incluyendo warmups;
se recalcularon 288 comprobaciones finales por etiqueta con endpoints claros.

validation.raw.tar.gz conserva los 1.057 archivos crudos, los 367 archivos de
fuente exactos probados, logs y artefactos de integración. validation.json enlaza
los ocho workers, huella del harness, archivos y límites. No se modificó código
ejecutable después de estas pruebas. La revisión local del delta terminó sin
hallazgos, solo con lectura y cálculos offline.

Solo se ejecuta jsdom, sin cargar el addon Rust. Las observaciones posteriores
a GC no son memoria pico ni ausencia universal de fugas. La ampliación conserva
tres rondas y dos endpoints claros por lote, timeouts finitos y Maps acotados
por las ocho filas; no agrega referencias fuertes al DOM ni una espera ilimitada.

Antes de ejecutar el diagnóstico hay que publicar el método y fijar su SHA,
huella y recibo. No concede aceptación de rendimiento ni autorización de merge.
