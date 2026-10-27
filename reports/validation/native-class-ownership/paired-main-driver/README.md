# Validación del driver y verificador pareado

Pasaron once tests por Node 22.12.0 y 24.14.1 Linux, y nueve en Windows Node 24
con dos casos de preflight Linux explícitamente omitidos. No se recogieron nuevas
muestras ni se reevaluó el gate de rendimiento.

La verificación reutiliza los cuatro workers reales publicados en d2c238fb.
Comprueba offline las ocho filas, tratamiento, afinidad, aislamiento, paquetes y
liberación de ambos runtimes. Las regresiones alteran copias privadas de esos
datos para demostrar rechazo de filas omitidas, muestras inválidas, recursos
retenidos pese a clear=true, paquetes con digest refrescado y afinidad incorrecta.

El roundtrip de fuentes copia y verifica 350 archivos reales: 333 del alcance
canónico y 17 del método, incluyendo módulos transitivos en reports/. Rechaza
bytes alterados y snapshots ausentes. El driver real conserva un directorio
existente y rechaza una huella de harness incorrecta antes de cargar paquetes
o lanzar workers. La prueba aritmética replica observaciones reales solo para
ejercer cálculo, conteos y umbrales; esas copias no son nuevas réplicas de estudio.

El reviewer nativo read-only terminó sin hallazgos accionables. Confirmó 32
workers y 4.608 duraciones por Node, secuencia, 350 fuentes, recursos y límites.
No ejecutó builds ni benchmarks nuevos. Los logs y hashes están en este directorio.

El harness compuesto tiene huella
fb2b88ed9fe44fb7c086c659d3e58385d17252401da1b3e4f38ed2a79e105d1f;
su alcance canónico conserva sourceHash 609e73b5a7f8781ecfd0c805461ac553021be09476e762869ebd295a885e638a.
Las distribuciones de producción permanecen congeladas. La procedencia de review
remota será provista y comprobada por el launcher después de publicar el SHA;
los campos declarativos no sustituyen esa comprobación.

La prueba positiva del archivo completo aún requiere una secuencia real. Antes
de ejecutarla se deben verificar review y procedencia del SHA publicado. El método
conserva todas las filas y presupuestos y no repite corridas para buscar aceptación.
