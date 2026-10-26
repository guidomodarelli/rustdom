# Estudio prospectivo de ownership con consumidores compartidos

Este documento registra el método antes de su ejecución; **no contiene resultados ni concede aceptación**.
La autorización anterior fue para un diagnóstico CPU/GC/JIT que ya terminó.
No iniciar este estudio antes de revisión limpia, publicación autenticada y
autorización explícita para esta secuencia nueva. No usar ni volver a lanzar
las etiquetas consumidas de los estudios anteriores.

## Hipótesis y cambio

Las factories nuevas comparten los métodos consumidores entre fixtures
temporales de warmup y medidos. El diagnóstico observó optimizaciones de
jsdom y del harness después del warmup; no demostró una causa única de los
rechazos. Esta variante puede no resolverlos. No se afirma mejora ni estabilidad
de JIT a partir de identidad compartida o de la calificación funcional.

El sampler derivado debe tener exactamente el hash del ejecutado en la
calificación funcional de `8ea5f569`, cuyos 80 procesos, 960 spans y contratos
están publicados. Se cambia solamente el wrapper externo para identificar
el estudio. El wrapper y sus contratos se prueban con reportes reales guardados,
sin usar esos tiempos para aprobar este estudio. El núcleo deriva de los 434
archivos congelados con hash `97284800087ef5e3a1e53d87a338a1e366cec220e654fd289d6b02bc8d812c7b`.
Las factories y los spans agregados después del stop clock son los ya calificados.

## Entradas, matriz y ejecución

Se reutiliza la preparación oficial `39906777389`, sin reconstruir paquetes:
ZIP SHA256 `8d74c353eca260e14eae3f055fc5fa9303ed7b781064144e51e85f57c10beae6`,
tar SHA256 `0a44778e3e694a6dcf65fffd1125913e10b9c1ed0bbeabd1d4e6f076e4d648d3`.
A0/A1 son el baseline checkpoint067/source67523bf3, B source5ef668c4;
J0/J1 son jsdom 27.4.0 independiente. Se comprueban las cinco distribuciones,
fuentes, inputs de build, herramientas y probes públicos originales antes y
después, junto con cada archivo del método y de la derivación.

Una única secuencia serial en Ubuntu 22.04/glibc 2.35, Node 22.12.0 primero
y Node 24.14.1 después. Conserva exactamente el schedule original completo:
AA y AB, ocho filas/tamaños, dieciséis posiciones/semillas 1..16, cuatro
factores de orden, ambos motores y ambas etiquetas, una carga por proceso.
Son 1024 procesos por Node y 2048 en total. Se registran los PID observados,
versiones, hashes de binarios, flags, prefijos RNG, módulos y afinidades.
Ambos binarios se autentican antes de comenzar Node22 y sus hashes se vuelven
a comprobar después de cada perfil. Un segundo binario incorrecto no consume
la mitad del estudio. El probe `--version` tiene timeout de 10000 ms y solo
se ejecuta después de comprobar el hash del ejecutable.
El hilo principal permanece en CPU2; se conservan las máscaras de los otros
hilos. No se desactiva JIT, GC natural ni compilación concurrente.

Se mantienen tres warmup exteriores, nueve muestras medidas y tres rondas de
warmup en el mismo realm, con GC antes del warmup. Se preservan HTML, primeras
mutaciones, campos consumidos, operaciones Range y hashes públicos originales.
Cada proceso conserva doce spans: 6144 warmup y 18432 medidos en total. Los
spans de warmup no participan del estimador y nunca se descartan del archivo.
Se guardan también los 24576 pares Window/Document y las tres rondas originales
de GC, con dos estados finales claros contra el baseline nativo por proceso.
Son observaciones finitas tras GC, sin memoria pico ni ausencia universal de fugas.
El colector conserva entre procesos solo copias de los escalares usados por el
estimador, no los reportes completos con módulos y trazas. Los reportes íntegros
permanecen en disco. Se registran snapshots de memoria del padre antes de los
workers y después de cada Node; no se interpretan como memoria pico ni forman
parte de la decisión de rendimiento.

## Decisión fijada antes de ejecutar

El estimador es el original: mediana agrupada de 144 duraciones por celda
(16 procesos × nueve muestras), conservando también medianas por proceso.
Control jsdom AA/AB ±2%, Rust AA ±5%, Rust AB +5%. Todas las filas y ambos
Node deben pasar. Una celda sin calibrar no aprueba aunque el número Rust
esté dentro del presupuesto. No se alteran límites, filas, semillas, posiciones,
warmup, muestras o estimador a partir del resultado.

Preservar el resultado anterior como `accepted:false`. Este estudio solo puede
decidir sobre el método nuevo y no recalifica las capturas históricas. Tampoco
certifica por sí mismo otros módulos, rendimiento de suites ni cumplimiento
completo de estándares. El runtime sigue siendo híbrido.

La etiqueta exclusiva es `ownership-shared-fixtures-v1`. El workflow rechaza
run_attempt distinto de 1 y cualquier segundo run no omitido en el historial
paginado, incluso si se elimina y reaplica la etiqueta. No hay reintentos
automáticos. Un error de integridad detiene la secuencia, conserva parciales
y deja el estudio consumido; un rechazo numérico en Node22 no impide ejecutar
la parte declarada de Node24. Se conserva el archivo íntegro incluso si falla.
El job externo dispone de 180 minutos; cada worker, 180000 ms. Un timeout no
autoriza otra secuencia. No se crea tag ni se mergea el PR sin aceptación real.

## Reproducción de lectura

El índice fija método, preparación, grafo congelado, derivación y todos los
archivos crudos. El replay exige el recibo del checkout revisado, comprueba
cobertura/orden y recalcula la decisión con el estimador original. No carga DOM
ni ejecuta código archivado. Los reportes funcionales de 80 procesos y las
capturas históricas se rechazan como evidencia de esta secuencia.
