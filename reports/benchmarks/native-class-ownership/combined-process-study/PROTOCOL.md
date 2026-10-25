# Método prospectivo con unidades por proceso

Esta declaración prepara el estudio `ownership-combined-process-means-v1`.
El núcleo numérico, manifiesto, capturador y lector de payload están implementados.
La preparación, activación, transporte externo y decisión se verifican con lectores
actuales y datos ya archivados, sin nuevas mediciones. `executionReady=true`
permite ejecutar únicamente el workflow declarado: exige recibo independiente del
método completo, revisión sin pendientes y ambos contratos aprobados sobre el
mismo SHA en su workflow exacto. El flag no es aceptación ni activa una captura.
La autorización permanente ya está concedida; no requiere otra confirmación.

## Candidato y referencias

Se utiliza únicamente el paquete ya calificado del artifact `12589402298`, run
`40168321423`, intento 1, fuente `7d977513`. Su matriz funcional aprobó seis jobs.
El archivo completo es `5b67fcc6…`, con 7824 miembros, seis enlaces y 577 archivos
seleccionados del candidato. El manifiesto del sampler observa 570 archivos de
`dist` y `package.json`, conforme a su interfaz original; las otras identidades,
tipos, locks, dependencias y fuentes siguen cubiertas por la verificación completa.
La huella de esos 570 archivos se deriva del ZIP independiente y se contrasta
contra el paquete físico. Los controles A0/A1/J0/J1 conservan sus hashes originales.

El candidato combina decisiones de StaticRange en Rust y colapso atómico de Range.
El runtime continúa híbrido. No está integrado ni aceptado en rendimiento.
Las fuentes del compilador y los snapshots de datos conservan sus identidades Git
reales por separado; no se sustituyen errores Git por un checkout ficticio.

## Factores conservados

`constants/protocol.json` y `settings.cjs` contrastan la declaración con los factores
congelados: ambos Node 22.12.0/24.14.1, ocho filas originales de las cuatro familias,
AA/AB, jsdom/rustdom, labels A/B, 16 posiciones, semillas 1…16, tres probes RNG,
CPU principal 2, mismo orden de factores y pares adyacentes.
Se conservan tres warmup spans, nueve duraciones medidas por proceso, tres rondas
de warmup dentro de cada realm y el orden de GC anterior al warmup.
El plan contiene exactamente los mismos tuples que el estudio histórico.

Son 1024 procesos por Node, 2048 en total: 18432 duraciones medidas y 6144 warmup.
Se observan 24576 Window y 24576 Document por separado. Cada proceso conserva tres
rondas de cleanup y exige dos estados finales claros, con baselines nativos.
Se guardan también las primeras rondas no claras y tres snapshots del padre.
No se añaden procesos o muestras tras ver resultados, ni se filtran outliers.

Para la futura captura quedan declarados 180 segundos por worker y 175 minutos
de captura. Antes de activar, se corrigió prospectivamente el límite global del
job de 180 a 200 minutos y luego a 201: 14 para los pasos de setup acotados, 175 de captura,
4 de archivo, 3 de upload y 5 de margen. La revisión detectó que el primer límite
podía cancelar la conservación de la única secuencia al agotar sus 175 minutos.
No se recorta ese tiempo científico ni se amplían los presupuestos ±2%/±5%.
El minuto adicional corresponde a materializar las dependencias revisadas y
comprobar run/job del CI exacto mediante API antes de medir. Evita confundir
checks con el mismo nombre provenientes de otros workflows. El checkout es
acotado y conserva la identidad Git real; no descarga ni reconstruye otro paquete.
Los workflows históricos y sus límites permanecen intactos. Una secuencia parcial,
rechazada o con timeout se conserva íntegra y no autoriza repetirla.
El run histórico de 2048 procesos tardó 5963,541 segundos; se usa solo como
observación de costo, sin reinterpretar su rechazo ni garantizar el tiempo futuro.
El workflow nuevo de contratos tiene su límite independiente de 20 minutos y
no recoge muestras. Un contrato entra al worker con un manifiesto inválido y
comprueba el sidecar de fallo antes de cargar un paquete DOM; no ejecuta workloads.

## Resumen e incertidumbre

Cada proceso aporta **una media aritmética de sus nueve duraciones**. Las 144
duraciones de un tratamiento/fila no se cuentan como 144 procesos independientes.
Se emparejan los dos labels por posición, nodo, fase, engine y fila: 16 pares
por comparación. Warmup y trazas crudas se conservarán, sin incluirlos en la media.

Se reutiliza el módulo Fieller emparejado ya probado, con cociente de medias y
covarianza dentro del par. El valor crítico bilateral nominal del 95% es
`t(0,975; 15)=2,131449545559323`, calculado con SciPy 1.15.3/NumPy 2.2.6 fijados.
Los intervalos son puntuales por comparación; no se afirma cobertura simultánea
del 95% para los 64 resultados. Tampoco se promete independencia estadística o
estado estacionario por haber creado procesos distintos. La inferencia depende
de sus supuestos; se preservarán orden temporal, factores y datos completos.

La separación entre niveles de repetición se apoya en
[Kalibera y Jones](https://kar.kent.ac.uk/33611/45/p63-kaliber.pdf) y
[Georges, Buytaert y Eeckhout](https://users.elis.ugent.be/~leeckhou/papers/oopsla07-stat.pdf).
Estos trabajos motivan tratar por separado invocaciones e iteraciones y cuantificar
incertidumbre; no validaron este sampler de Node ni garantizan sus supuestos.
La fórmula emparejada concreta y su referencia independiente están documentadas
en `../range-combined-study/README.md`.

## Criterios, sin cambiar presupuestos

| Comparación | Intervalo completo requerido del cociente B/A |
| --- | --- |
| jsdom AA y AB | entre 0,98 y 1,02 |
| rustdom AA | entre 0,95 y 1,05 |
| rustdom AB | límite superior como máximo 1,05; mejoras permitidas |

Se requieren los 64 criterios, ambas versiones Node y todas las filas. Un intervalo
no acotado, no estimable, inválido o que no cabe completo en el presupuesto falla
el criterio, aunque su punto parezca favorable. No se recortan límites ni se aplica
tolerancia al presupuesto. La tolerancia numérica de los tests solo compara
valores de referencia y no interviene en ese gate.

Esto cambia prospectivamente el estimador y exige incertidumbre, conservando los
presupuestos originales. Los estudios históricos y sus rechazos no se recalculan.
`compare()` solo produce criterios numéricos: siempre devuelve
`captureAuthenticated=false`, `performanceAccepted=null` y `gateReevaluated=false`.
La futura aceptación requiere además autenticar captura completa, método, proceso,
paquete, salidas públicas, spans, seeds y recursos con el replay actual revisado.

## Contratos y límites de esta fase

La calificación funcional del nuevo wrapper usa un plan separado y fijo:
64 procesos, 32 por Node, con las ocho filas, ambos engines y ambos labels,
únicamente fase AB y posición 0. Conserva los tres warmup spans, nueve duraciones,
trazas de cleanup y observaciones separadas de 768 Window y 768 Document.
Sus reportes declaran `functionalOnly=true`, `purpose=functional-qualification`,
`performanceAccepted=null` y `gateReevaluated=false`. No se aplican presupuestos
ni intervalos de aceptación a esas duraciones. No es la captura de 2048 procesos.
El replay funcional usa lectores actuales y requiere los inputs físicos originales;
todavía no es un replay integral transportable. No ejecuta código del archivo.
Tras la revisión del lector, la identidad de la única calificación original queda
fijada independientemente en `constants/functional-qualification.json`, contrastada
contra los bytes físicos del productor y el index original. Permite leer esos
datos con las correcciones de trazabilidad del lector sin editar las observaciones
ni repetir procesos. Solo se admite ese grafo funcional conocido o el grafo actual;
ninguno concede aceptación de rendimiento. El comando exacto y el commit de cada
sidecar deben coincidir con el SDK, plan, derivación y captura declarados.
Esa identidad fija también el index terminal íntegro, derivación y grafo434.
El replay funcional de esta fase requiere aún el checkout productor Git8eb2f9b3
con los lectores actuales superpuestos explícitamente y sus inputs físicos
originales; no se declara que ese overlay sea un checkout limpio ni portable.
`fixtures/functional-worker.json` conserva un proceso real de ese archivo para
probar cambios de executable, worker, flags, commit y propósito sin ejecutar DOM.

El capturador registra la ubicación original del paquete y de la captura. El lector
portable conserva los comandos con esas rutas y lee los archivos desde la nueva
ubicación, sin exigir que existan las rutas originales. Solo se reubican los campos
`copies`, `roots` y `dependencies` del manifiesto mediante reglas explícitas;
todo el resto se compara íntegro con el paquete independiente ya calificado.
Nunca se normalizan sourceCommit, sourceChanges ni sourceGitErrors.

El materializador extrae únicamente datos autenticados del archivo funcional;
su modo `--derived` permite copiar los 456 miembros de la derivación original
para verificar sus bytes con lectores actuales, sin ejecutar ese código. Esta
derivación sigue fijada por su SHA, HEAD y cuatro controles originales. El modo
científico exige los controles actuales y no admite ese modo funcional histórico.

Los reportes JSON tienen un límite de lectura de 16 MiB. El ejecutable Node se
verifica por separado con bloques reutilizables de 1 MiB y límite de 256 MiB,
sin cargarlo entero ni confundirlo con un reporte. El inventario conserva todos
los archivos y directorios, rechaza enlaces y verifica los datos sin importar
módulos desde la captura. Los parciales se guardan aun si falla su inventario.

Los fixtures son sintéticos y no son capturas de rendimiento. Los contratos ejercen
la matriz completa, incertidumbre entre procesos, medias sin overflow, presupuestos,
rechazo de tuples incompletos/duplicados/reordenados y salidas divergentes.
La preparación real se verifica sin importar módulos del paquete DOM.
El CI autentica sus dependencias y los 599 pins históricos antes de ejecutar tests.
El grafo histórico de 434 archivos no se modifica.

Este núcleo no incorpora objetos DOM/N-API, caches de observaciones globales o
callbacks persistentes. Guarda acumuladores y resultados acotados por la matriz.
La evidencia de memoria real del candidato sigue separada en
`reports/memory/range-combined-packages/20261025-assembly/`; no demuestra memoria
pico ni ausencia universal de fugas. El lector portable autentica bytes y conserva
las rutas originales; jamás ejecuta scripts del archivo. La verificación de payload
mantiene captureAuthenticated=false y performanceAccepted=null. La decisión
externa extrae desde un ZIP/TAR autenticado hacia un destino nuevo, vincula el
payload completo a run/job/intento/SHA, recibo y grafo revisados, comprueba las
2048 líneas de progreso y resultado terminal, exit-code y conclusiones API.
No acepta un árbol de extracción aportado sin verificarlo contra el archivo.
Solo una captura completa con los 64 criterios y terminales coherentes establece
performanceAccepted; los errores de lectura o infraestructura mantienen null.
El transporte por sí solo nunca reevalúa el gate. Cada decisión conserva sus
parciales, trazas y manifiesto completo; nunca ejecuta módulos archivados.
La prueba positiva integral de 2048 procesos requiere la futura captura completa;
64 procesos funcionales no pueden sustituirla. Sin integración, tag o merge de
ownership antes de aceptar rendimiento. La etiqueta de este método se aplica
una sola vez después de publicar y revisar el SHA habilitado y sus checks.
