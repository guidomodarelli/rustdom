# Validación del ejecutor con afinidad del principal

Las carpetas initial y final conservan stdout, stderr, sidecars y logs de seis
contratos por Node 22.12.0 / 24.14.1. Cada ejecución funcional usa la referencia
checkpoint 67, el candidato y jsdom 27.4.0 reales, con las ocho filas originales.
Las duraciones de estas pruebas no pertenecen al estudio de rendimiento.

La validación final agrega hashes fijos de ambos addons y exige conservar la
máscara de cada hilo de fondo que siga observable al configurar. Pasó 6/6 en
ambos Node. El verificador del archivo también exige todos los hashes de sus
fuentes, stdout, stderr y sidecars; se probará adicionalmente con la corrida
completa y copias privadas alteradas una vez que exista esa evidencia real.

before-performance.json fija doce archivos del método, las identidades de las
fuentes originales y el workspace, los resultados y límites. La huella canónica
sigue siendo 333 archivos y hash8332276799c5ccc18c7a45a5136a856b039736597d5e104e22f074f8e23f1ddd.
Producción y el harness original no se modificaron. Las pruebas de preservación
dejan un sentinel y comprueban que un segundo intento no lo modifica.

La agregación usa copias de observaciones reales para probar aritmética y
rechazo de deriva del control. Esas copias no son procesos adicionales ni
muestras independientes y no se usan para afirmar rendimiento.

Los reportes originales incluyen memoria posterior a GC, sin WeakRefs o
medición de pico. No sustituyen las regresiones y observaciones de recursos
del hito de ownership. No hay aceptación de rendimiento a partir de estos tests.

La revisión nativa independiente final terminó con cero hallazgos accionables.
Fue estática, sobre las fuentes finales, sin ejecutar benchmarks o cambiar archivos.
