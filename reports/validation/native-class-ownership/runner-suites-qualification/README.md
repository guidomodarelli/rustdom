# Calificación de suites completas para medir tiempo total

Pasaron doce CLIs reales en Node 22.12.0/24.14.1, con los addons oficiales
A/checkpoint067 y C: Jest 23, Vitest normal 34 y Vitest VM 36 tests por paquete
y Node. Son 372 tests: 356 de las suites originales y 16 probes adicionales
de procedencia. No hay exclusiones. Los ocho contratos del arnés también
pasan: destino disjunto, suite incompleta rechazada antes de instalar, exit 7
real preservado y Jest real rechazando el otro paquete nativo, en ambos Node.

El probe construye y clona Range mediante el `document` del entorno, consume
sus resultados y observa dos asignaciones en el NativeRange seleccionado.
Las dieciséis observaciones positivas confirman 32 asignaciones y el módulo
resuelto dentro del paquete correcto. No es un test de importación solamente.
La revisión estática independiente no encontró hallazgos accionables; el cierre
de evidencia se registra por separado en el recibo de revisión final.

## Inputs y reproducción

`qualification-and-inputs.tar.gz`: 77.018.152 bytes, SHA-256
`905f195308e58d038eab929b6905cdd6ae9752e482de6144f927b85a985e14dd`,
21.590 entradas bajo `runner-suite-qualification/`. Incluye fuentes de cada
versión del método, paquetes, configuraciones, instalación, comandos, procesos,
JSON completos, stdout/stderr, caches de output y los fallos anteriores.
El método final ejecutado está en `qualified-method/`; sus diez archivos
coinciden con la identidad guardada al calificar.

`static-prepared/` es la preparación final y `static-contracts/` y
`static-qualification/` contienen las pruebas finales. Las copias laterales
permiten consultar índices, resumen y recibo sin extraer el tar. Los nueve
archivos originales de integración y las tres configs coinciden con Git
`eaeca4af`, también idénticos a checkpoint067. Los adapters vienen de las
fuentes archivadas oficiales. No se recompiló Rust ni se modificó la
preparación oficial 39720077911/artefacto12400802735.

Se instalaron 475 paquetes por `npm ci` con Node24.14.1/npm11.11.0 y lockfile
fijado; los archivos de producción comparados siguen idénticos a los oficiales
(se exceptúa el lockfile instalado de node_modules porque incluye dev).
Todos los archivos y enlaces de dependencias están identificados. El tar
conserva una copia completa de las dependencias finales y omite dos copias
duplicadas de instalaciones previas. `dependency-deduplication.json` prueba
igualdad de bytes, targets de enlaces y modos. Sus mtimes históricos distintos
no se preservan. Para reconstruir esas dos copias, copiar `static-prepared/node_modules`
a `prepared/node_modules` y `final-prepared/node_modules`, conservando enlaces
y modos. No se reescriben los recibos históricos.

Para verificar la preparación final después de extraer, desde este repositorio:

```sh
node -e 'console.log(require("./reports/benchmarks/native-class-ownership/runner-suites/prepare.cjs").verify(process.argv[1]))' EXTRACTED/runner-suite-qualification/static-prepared
```

Ese comando lee y compara archivos; no ejecuta suites ni acepta rendimiento.
El protocolo y comandos de calificación están en
`reports/benchmarks/native-class-ownership/runner-suites/PROTOCOL.md`.

`readback.py` leyó el tar en Windows Python3.12 y verificó 15.298 archivos de
entrada, diez fuentes del método, las doce suites, 372 tests, dieciséis probes
y ocho contratos. `readback.json` registra el resultado. Su primer intento
asumía un solo salto de enlace y falló con la cadena válida del ejecutable
pnpm; lector y transcripción permanecen en `reader-history/`. Se corrigió la
resolución de múltiples saltos con detección de ciclos, sin cambiar el tar.
`relocation.json` y sus logs prueban además extracción del paquete final en
otra raíz y verificación Node22 exit0, sin ejecutar suites o mediciones.

## Fallos preservados y límites

La primera calificación se detuvo tras un test donde se esperaban 23: el
archivo de microbenchmarks solo conservaba un helper de integración. Se agregó
el inventario completo de nueve archivos fijados desde Git y un contrato de
rechazo temprano de un árbol incompleto. Esa salida permanece en `qualification/`
y sus fuentes en `initial-method/`.

La siguiente pasó Jest 23 pero falló al cargar Vitest: el bundler trasladaba
el import dinámico relativo de la config a `.vite-temp`. Se reemplazó por
imports estáticos. Se conserva en `final-qualification/`, con sus fuentes en
`full-suite-method/`. Las calificaciones posteriores se ejecutaron solo después
de esos cambios reales, sobre destinos nuevos; no son reintentos de rendimiento.

Esta evidencia califica herramientas. Los tiempos internos incidentales de
los reportes no se usan como muestras ni como presupuesto. Falta publicar y
revisar la receta del ensayo de tiempo total antes de ejecutarlo. No acepta
los microbenchmarks de ownership, no acredita código DOM migrado y no cierra
el hito ni autoriza merge/tag. No se repiten Rust, corpus o suites de plataforma
ajenas a este arnés, porque el runtime no cambió; el CI se sigue por SHA.
Los CI generales de `58650e58` y `81ed78cb` terminaron verdes. El recibo
`ci-parent.json` conserva los ocho checks del último; no corresponde al SHA
posterior que publica este nuevo arnés y no acepta el presupuesto de ownership.
