# Estudio prospectivo de ownership con collapse nativo

Se declara una única secuencia nueva para el candidato calificado y preparado
en f06f9fdd. La autorización permanente de AGENTS.md cubre su activación;
no solicitar otra confirmación. Primero publicar revisión local sin hallazgos
y aprobar los cuatro checks específicos y los cuatro checks generales
(tres plataformas y agregado de benchmarks) del SHA exacto. La etiqueta ownership-range-collapse-v1
se aplica una vez. No relanzar, reintentar ni completar muestras tras un fallo
o rechazo. Los estudios anteriores conservan sus decisiones y archivos.

## Hipótesis y tratamiento

B contiene el guard de ownership y la actualización atómica NativeRange.collapse
que reduce dos cruces a uno cuando ambos owners son idénticos. Los owners
distintos mantienen el orden previo de referencias. Conserva la semántica y
el guard; no incluye el patch cold/inline-never del estudio frío rechazado.
La hipótesis es reducir el costo de la ruta habitual, especialmente range-control;
la reducción estática de cruces no demuestra una mejora temporal.
El estudio evalúa la variante completa frente al baseline, sin atribuir una
causa única a diferencias temporales ni a stacks V8.

Se utiliza únicamente el tar8c430f0b publicado, con6981archivos y seis enlaces.
A0/A1 mantienen03568ce9 y addon1c46896c; B es distribución569archivos/0d2c0835
y ELF43410883 del artifact12574603695/run40128890776. J0/J1 son copias físicas
independientes de jsdom27.4.0/c458b9e9. Dependencias3531archivos/149eb8f5,
locke154f202 y package.json3c1570af de B permanecen fijados. No recompilar Rust,
reinstalar paquetes ni elegir otro artifact según resultados favorables.

El código ejecutado por B tiene hash8a7baa9c. Se preservan el snapshot Git local
b63cf834+3src y la procedencia hospedada da0f4f80 del mismo código, separadas.
El arnés de control mantiene sourceHash5ef668c4 y su Git HEAD real del método;
no se confunde con la implementación compilada de B ni se normalizan campos
sourceCommit/sourceChanges/sourceGitErrors. El runtime sigue híbrido.

## Diseño congelado

Se reutilizan el sampler, los factores del scheduler, fixtures compartidos y
el estimador revisados. Cambia únicamente la disposición entre procesos:
los dos labels de cada fila quedan consecutivos. El archivo histórico completo
40012710923 contiene1024pares, todos separados por8posiciones; la disposición
nueva reduce esa distancia ordinal a1sin agregar observaciones. Esto busca
reducir la separación temporal de los controles bajo variación del host; no
identifica una causa ni garantiza calibración. No hubo mediciones nuevas para
elegir este método. Se mantiene el orden de grupos phase/position/engine/filas
y el orden original de los dos labels en cada par. El árbol derivado conserva íntegro el productor frío anterior
bajo base/, verificándolo con el lector actual. Ese wrapper frío no se
ejecuta: el wrapper nuevo carga su fábrica de sampler con la identidad nueva.
benchmarks/worker.cjs conserva el sampler calificado SHA d24c7282 y los spans
originales. Los archivos y metadatos del base no se reescriben ni relabelan.

Se mantienen CPU2 para el hilo principal, afinidades de los demás hilos,
ocho filas y todos los factores balanceados AA/AB, dos motores, dos labels y
semillas V8 1..16. Hay1024procesos por Node22.12.0/24.14.1:2048en total,
con3warmup y9medidas por proceso:6144 y18432duraciones respectivamente.
Tres rondas de warmup dentro de cada realm, GC previo y relojes/spans originales.
Cada proceso conserva tres rondas de cleanup y requiere los dos estados
finales claros, con24576Window y24576Document separados si completa.
Se conservan baselines nativos por proceso y tres snapshots del padre.

El estimador sigue siendo la mediana combinada original. Una copia de las
observaciones completas se presenta en el orden canónico que exige su API,
sin mutar reportes, duraciones, pesos ni muestras, y conservando en el índice
el orden real de ejecución adyacente. Los contratos reproducen exactamente
las decisiones históricas con ese estimador sin relabelar sus datos:
 jsdom debe estar
en±2%, Rust AA en±5% y Rust AB no superar+5%, en todas las filas de ambos Node.
Rechazar un control rechaza la decisión. Publicar todas las filas, regresiones,
warmup, muestras, primeras rondas no claras y parciales, sin repetir la secuencia.
No se selecciona un subconjunto ni se agregan semillas/procesos/muestras.

Los dos ejecutables Node se autentican por versión y SHA256 independientes.
Host Ubuntu22.04/Linuxx64/glibc2.35 y restricciones de entorno originales.
Cada worker tiene180000ms. El job tiene180min y el step de captura175min,
reservando margen para conservación. Ante timeout/error se guarda el parcial
sin completar duraciones faltantes. Este límite operativo no cambia presupuestos.

## Identidad y lectura

sourceFiles() incluye los511pins históricos, el arnés434, el método nuevo,
workflows, preparador de paquetes y sus entradas transitivas revisadas.
La revisión publicada fija sus bytes; los checks prueban el mismo SHA.
La derivación solo usa código actual autenticado, evita caches Python previos
y conserva separadamente la metadata del base. Un hash recalculado en el
archivo no puede sustituir productores, controles, sampler o paquetes.

--plan expone la matriz completa sin cargar DOM; --preflight autentica código,
paquetes y contexto sin capturar. --capture exige host/workflow/repositorio
declarados, intento1, revisión y activación únicas. El guard comprueba todas
las páginas de runs y rechaza cualquier otra ejecución no omitida del workflow.
Un error de observación no permite reiniciar.

--verify usa código actual para leer todos los procesos y reproducir la decisión;
nunca ejecuta scripts archivados. Autenticar primero el artifact exterior por
ID/run/commit/intento/nombre/tamaño/digest y conservar ZIP/tar/API/logs/manifiesto.
Usar un checkout Git Linux real y ambos Node fijados para el replay, sin inventar
metadatos Git. Si el resultado es negativo o parcial, conservarlo íntegro.

Los contratos reutilizan datos históricos reales y el mismo estimador para
reproducir su rechazo sin convertirlos en evidencia del nuevo candidato.
La QA offline no captura muestras nuevas ni prueba que una futura secuencia
completará. Los snapshots de recursos no miden memoria pico ni prueban ausencia
universal de fugas. Aceptar rendimiento exige una decisión completa y su
integración al gate, con pruebas/revisión, antes del tag/merge autorizado.
