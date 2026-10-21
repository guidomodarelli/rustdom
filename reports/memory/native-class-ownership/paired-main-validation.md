# Liberación de realms del worker público y sampler pareado

Resultados de validación por Node 22.12.0 y 24.14.1 Linux, usando distribuciones
reales e independientes de checkpoint 67, candidato ownership y jsdom 27.4.0.
No se reconstruyó el addon ni se modificaron algoritmos DOM.

El worker puede devolver referencias débiles a Window y Document por separado,
creadas después de timer, assertions y checksum, antes de su cleanup original.
Incluye warmups. El modo ordinario conserva el resultado serializable anterior.
La opción no introduce referencias fuertes a los targets.

Los tests observan ocho filas en tres runtimes y setup Vitest/VM en dos: 336 pares
por Node. El helper de memoria exige dos endpoints consecutivos liberados en un
máximo de tres rondas. En cada Node los dos workers pareados adicionales observan
384 pares: cada lote ejecuta exactamente tres rondas y exige las últimas dos
liberadas, para ambos runtimes y todas las referencias anteriores del proceso.

Resultado total: 1.440 Window y 1.440 Document observados en estos escenarios,
sin supervivientes en los endpoints requeridos. Se comprobó además el predicado
de recursos nativos de memory-endpoint.cjs contra el baseline de cada runtime,
incluyendo árboles, rangos, observers, listeners y clases N-API. Las observaciones
de heapUsed, external y RSS son posteriores a limpieza; no son máximos del proceso.
No permiten afirmar ausencia absoluta de fugas ni reemplazan los escenarios de
error de constructores del hito de ownership.

Datos escalares, todos los intentos de endpoint, máscaras de hilos, manifests,
procedencia y logs están en
reports/validation/native-class-ownership/paired-main-sampler/.
La comparación de rendimiento completa y su aceptación siguen pendientes.
