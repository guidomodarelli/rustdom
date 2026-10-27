# Método calificado del diagnóstico adicional autorizado

El usuario autorizó un diagnóstico nuevo y separado de CPU/GC/JIT de jsdom en
Node 22/24. La captura completa aún no se lanzó; requiere publicar y autenticar
este método y su revisión. El estudio 39921160254 sigue rechazado, sin cambios
de presupuesto, sin tag ni merge y sin crédito de migración Rust.

## Implementación y alcance

Se reutiliza el preparador sampler-diagnostics y el sampler público actual,
derivando copias verificadas de sus 434 fuentes. Las anotaciones son escalares
y quedan fuera del timer. Se conservan fixtures, tres realms de warmup, nueve
medidos, warmup de operaciones, GC, resultados y teardown. El modo CPU usa
Inspector+GC y el modo JIT usa el logger V8+GC: V8 desactiva su file logger al
activar CPU profiling. Los datos ausentes por modo son null; no se atribuyen
eventos de un proceso a las operaciones del otro.

La secuencia completa fijada es 64 procesos: ambos Node, ocho cargas, posiciones
0/15 y ambas etiquetas. Cada modo cubre ambas copias entre las dos semillas.
No es un contraste A/B, ni una muestra representativa de las 16 posiciones del
estudio de aceptación. Los tiempos instrumentados no aceptan presupuestos.

## Evidencia de calificación

La calificación final ejecutó 32 children reales, 384 spans y384 Window/Document
por tipo. Los 64 endpoints finales quedaron claros; las 16 sesiones Inspector
se detuvieron y desconectaron. Ver reports/memory/jsdom-telemetry-method.*.
Pasaron 12 contratos por Node 22.12.0/24.14.1, con los resultados públicos iguales
al jsdom independiente original, flags, Node/PID observados, todos los spans,
CPU/GC/JIT, deltas firmados, límites temporales, fuente alterada, Python
optimizado, fallo de proceso sin retry y preservación de output existente.

El archivo original de calificación de 43372036 bytes contiene 2094 archivos
regulares / 575283439 bytes sin filtrar. SHA256:
031d4e51c517d131bd76eb86e986b3b3a2701aee4bd3a877fa449106871b6962.
Se extrajo en otra ruta, se cotejó cada miembro contra el original y pasaron
los contratos de lectura en ambos Node. Los contratos finales incorporan
también el pin del worker intermedio leído por el preparador reutilizado.
Los hashes de método finales están en review.json; el archivo conserva las
versiones históricas de los lectores que produjeron sus datos y su replay.

## Fallos conservados y correcciones

Dos intentos parciales completaron un child cada uno, pero el lector no pudo
encontrar anclas JIT porque Inspector desactiva el file logger. Se conservan
ambos, sin reutilizarlos como datos de la herramienta final ni de aceptación.
La prueba --prof/--prof-process confirmó el formato, pero no se adoptó para
atribuir CPU por intervalo: sus timestamps representan emisión del log desde
otro thread. Sus datos y comandos quedan separados como prueba de capacidad.

El siguiente intento se detuvo al leer un delta CPU negativo tras cuatro
children exitosos. Se corrigió el lector para conservar todos los deltas
firmados y se continuaron solo los 28 children restantes. El índice original,
el fallo y las revisiones están conservados; no se repitió ningún child.
Los 14 deltas negativos observados siguen en los perfiles y el análisis.

La revisión aislada encontró un P2 de identidad autorreferencial. Se corrigió
para verificar Node/PID contra el proceso observado y se probó el rechazo de
copias de reportes reales relabeladas. La revisión final cerró el P2 sin otros
hallazgos accionables. No se ejecutaron nuevas suites DOM/Rust del producto:
su runtime 5ef sigue intacto y el CI general c71ede39 pasó sus ocho jobs.

## Reproducción y límites

Extraer qualification.tar.xz en una ruta nueva. Desde este checkout del método:

```sh
RUSTDOM_JSDOM_TELEMETRY_QUALIFICATION=/ruta/qualification \
node --test reports/benchmarks/native-class-ownership/jsdom-telemetry/contracts.spec.cjs
```

Los 12 contratos solo leen los perfiles guardados y ejercen errores de las
herramientas; no vuelven a producir perfiles DOM. El archivo contiene también
los helpers usados en QA, algunos con rutas operativas de esta máquina.
No ejecutar otra vez los comandos productores archivados para hacer replay.

Los brackets de reloj exponen incertidumbre observada en los extremos, sin
cota universal de deriva. Un evento de emisión JIT no equivale a CPU o pausa;
los ticks muestreados pueden no cubrir operaciones cortas. El CPU del proceso
incluye threads y costos de sus lecturas. No se filtran outliers ni se corrigen
duraciones restando GC/JIT. Toda conclusión debe conservar esos límites.
