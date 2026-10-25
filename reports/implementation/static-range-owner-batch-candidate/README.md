# Candidato Rust: owners agrupados de StaticRange

Esta variante agrega `initializeStaticRangeWithOwners` y utiliza un callback para
identificar ambos owners después de las mismas validaciones DOM en Rust. Conserva
`initializeStaticRange` con su contrato anterior y sus callbacks individuales.
No está integrada en el runtime publicado. El runtime continúa híbrido y los
benchmarks de esta variante todavía están pendientes: `performanceAccepted=null`.
El estudio anterior 40184510898 conserva su rechazo completo y no se repite.

## Diseño y alcance

Rust mantiene las decisiones de tipos de nodo, el orden y cortocircuito de lecturas,
la validación de identificadores y la creación del estado numérico. El binding
solo transporta las dos identidades en orden y conserva los owners visibles a V8.
La nueva ruta crea un array temporal de dos números; su costo debe medirse junto
al ahorro de un callback. La cantidad de callbacks no prueba una mejora temporal.

Se validan los elementos del par antes de asignar un NativeRange. No se mantienen
borrows de TreeStore durante callbacks/getters ni se crean referencias persistentes
JS. Las excepciones originales, incluso valores no Error, pasan por el mismo
controlador de errores. Los casos incluyen reentrada desde el callback y desde un
getter del array, rechazo sin asignación nativa y la identidad CJS/ESM real.

La conversión WebIDL, factories de realm y otras dependencias de jsdom siguen en
JavaScript. Esta variante no retira esos módulos ni incrementa por sí sola la
migración de producción o el inventario acreditado como Rust completo.

## Fuentes y reproducción

`source.json` fija Git base f781c3b7549a86b6aa8b5a34d2bbb32038c315b7, diez preimages,
diez fuentes resultantes, lockfiles, el patch y los contratos. `range-combined.patch`
conserva el colapso atómico previo y cambia la construcción StaticRange. La
reproducción independiente aplicó el patch sobre otro checkout Git Linux limpio
y obtuvo exactamente las diez fuentes. No se promete reproducibilidad binaria entre
rutas, plataformas o toolchains; cada addon ejecutado tiene su propio hash.

Usar un checkout limpio separado y un directorio nuevo de prueba. CURRENT es el
repositorio publicado con los helpers revisados; SOURCE es el Git base limpio:

```sh
python tools/candidate.py --prepare CURRENT SOURCE PROOF
python tools/candidate.py --qualify CURRENT SOURCE PROOF NODE
```

El preparador conserva entradas sucias y salidas ajenas. Reutiliza tres helpers
actuales fijados por SHA y sus dos configuraciones transitivas, compilando bytes
autenticados sin caches pyc. Los imports entre helpers usan esos mismos módulos
verificados. `interaction.spec.cjs` conserva la fixture canónica previa; los
contratos nuevos y consumidores tipados se agregan a la preparación.

La calificación ejecuta build Rust/addon, fmt/Clippy, consumidores reales,
compatibilidad, Jest, Vitest, VM, corpus HTML/WPT y memoria. CI usa Linux, Windows
y macOS con ambos SDK, con límite de 60 minutos por job y 40 para calificación.
Los programas del ZIP de QA no deben ejecutarse: reproducir desde Git y el patch
actual, con Node 22.12.0/24.14.1 y Rust 1.99.1.

## Evidencia local y pendientes

Linux pasó 315 tests Rust, fmt, Clippy, seis contratos nuevos y 84 dirigidos por
SDK; también los consumidores tipados CJS/ESM reales. Por SDK pasaron 3784 pruebas
de compatibilidad más nueve del proceso de fixtures, 22 Jest, 33 Vitest, 34 VM y
1784 casos HTML comparados. Se conservan ocho exclusiones HTML script-on.
WPT comparó 240 fixtures y 83007 assertions: coincidieron con jsdom, incluidos
1203 fallos compartidos, una exclusión y una suite bloqueada; complete=false.
Es evidencia de paridad en ese corpus, no una certificación completa de estándares.

El addon local tuvo SHA256 f8c8af92763844a1128742126fbd2139b748c699a93d1c1b13245a517b3e3ec3.
Los logs íntegros y reportes de ambos SDK están en
reports/validation/static-range-owner-batch/20261025/local-qualification.zip,
con manifiesto completo en summary.json. La reproducción del patch verificó sus
diez fuentes; cuatro contratos reales de preparación pasaron en Windows y Linux.
La invocación pública de calificación usada por el CI pasó completa en Node 24:
24 comandos, incluido build, suites, memoria y ambos consumidores tipados.
Su ZIP separado conserva 150 miembros; el addon resultó del mismo SHA f8c8af92.
Windows/macOS del runtime candidato y la matriz CI completa todavía están pendientes.

Los probes de memoria observaron Window y Document por separado y controles
retenidos. En StaticRange, seis ciclos por SDK terminaron con 774 estados nativos
creados/liberados y live=0; se conservan también los seis ciclos de collapse.
Metodología, JSON completos y límites: reports/memory/static-range-owner-batch/20261025/.
No se afirma memoria pico ni ausencia universal de fugas a partir de pruebas finitas.

No hay tag ni merge de ownership ni aceptación de rendimiento. El próximo estudio
necesita un método y paquete nuevos técnicamente justificados y revisados antes de
ejecutarse, preservando los presupuestos originales y todos los rechazos históricos.
La autorización permanente permite continuar sin otra pregunta.

## Corrección de preparación en runners shallow

El primer CI 40204293701 del SHA c331cc84 falló en macOS y Windows antes del
build: `git clone --shared` devolvió 128 en las fixtures. El stderr hijo no quedó
conservado, por lo que no se afirma una causa Git interna concreta. Los cuatro
artifacts completos, sus digests y el log original quedan preservados en
reports/validation/static-range-owner-batch-ci-preparation/20261025/.

Las fixtures ahora crean un índice Git independiente y leen el object store
mediante alternates, copiando la frontera shallow si existe. Es el mismo enfoque
de preparación ya usado por el candidato anterior. Evita el transporte de clone
sin cambiar la fuente, su HEAD ni el patch. Cada comando Git conserva stdout,
stderr y un error con contexto; los límites están en la configuración del tooling.

CI ejecuta prepare-platform.spec.py: cuatro contratos sobre la fuente original,
cuatro sobre una fixture shallow explícita y uno con una frontera inválida para
comprobar que el error Git real quede conservado. Linux y Windows aprobaron los
nueve. El wrapper utiliza el ejecutor fijado por SHA, con timeout y limpieza del
grupo de procesos. El workflow pasó actionlint. La corrección no cambia el addon,
la semántica DOM ni su aceptación; la nueva matriz remota sigue pendiente.
