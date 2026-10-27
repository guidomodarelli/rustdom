# Tiempo completo de Jest y Vitest: preparación y contratos

Estado: se prepara la medición; todavía no hay ensayo de rendimiento ni
presupuesto aceptado. Los microbenchmarks anteriores permanecen rechazados.

El objetivo pide medir suites completas, además de operaciones DOM y puente.
Los estudios de ownership disponibles cronometran operaciones públicas; sus
resultados no son tiempos completos de los runners. Este trabajo agrega ese
entregable y no intenta explicar el rechazo de los controles jsdom con otra
variante de emparejamiento, warmups o flags de compilación.

## Entradas

Reutilizar exclusivamente los binarios A/checkpoint067 y C de la preparación
oficial 39720077911, artefacto 12400802735, verificada con el mismo pin
independiente del estudio hosted. No recompilar ni modificar esa preparación.
Copiar A0/A1/B con sus distribuciones y package.json exactos y adapters de
`src/environments` de sus fuentes archivadas, idénticos entre A y C. La
preparación de microbenchmarks no conserva la suite completa de integración:
obtener sus nueve archivos y las tres configuraciones desde Git `eaeca4af`,
idénticos a checkpoint067. Sus hashes y nombres exactos se fijan en constantes
y se comprueban antes de instalar; no inferir completitud por existir el directorio.

Instalar dependencias reales de desarrollo con `npm ci --no-audit --no-fund`
en un directorio nuevo, Node24.14.1/npm11.11.0 y lockfile fijado. Registrar todos sus archivos, enlaces y
versiones: Jest 30.5.1, Vitest 5.0.0, React 19.3.0 y entorno abstracto 30.5.0.
Comparar los archivos de producción compartidos contra la preparación
oficial; el lockfile instalado de node_modules es distinto porque incluye dev.
No usar mocks, overrides de resolución o un addon reconstruido. La instalación
parte sin caches de Vite previos. Conservar y comprobar la identidad de
todos los inputs antes/después de los contratos; los outputs quedan separados.

## Suites y procedencia observable

Ejecutar las suites originales de Jest, Vitest normal y ambos pools VM, sin
excluir archivos o tests. Agregar un probe por entorno: crea y clona un Range
mediante `document`, comprueba su contenido y observa dos asignaciones en el
NativeRange del paquete seleccionado. Registra el módulo nativo resuelto y su
raíz; debe coincidir con el runtime elegido para el entorno. No es un simple
test de importación. Las cantidades previstas con ese probe son 23, 34 y 36
tests respectivamente; cualquier fallo, skip, discrepancia o proceso no cero
invalida el contrato y conserva la evidencia parcial.

Usar Node 22.12.0 y 24.14.1 reales, sin NODE_OPTIONS/NODE_PATH heredados. Jest
conserva `--runInBand` y agrega `--no-cache` y salida JSON. Vitest conserva sus
workers y pools declarados, con `--no-cache`; un wrapper de configuración solo
redirige `cacheDir` a un directorio nuevo de output. No cambiar JIT, afinidad,
política de energía ni el código de producto. Registrar host y comandos.

La calificación ejecuta A0 y B en los tres runners de ambos Node, doce CLIs.
Sus JSON y logs son pruebas funcionales del arnés, no muestras para aceptar
rendimiento ni baselines para elegir un resultado favorable.

## Condiciones de una medición posterior

Antes de ejecutar un ensayo, publicar y revisar una receta completa que fije
orden, replicación, estimador, presupuestos y límites sobre estos inputs ya
verificados. El tiempo externo debe abarcar inicio del proceso, carga,
ejecución de la suite y teardown hasta exit, y distinguirse del tiempo interno
que informa cada runner. Guardar todos los resultados, incluso rechazos.
No iniciar esa medición como parte de la calificación.

Estas suites incluyen aserciones internas nativas y no se presentan como una
suite jsdom independiente. La comparación completa propuesta es A/A y A/C;
la paridad con jsdom mantiene sus corpus y pruebas diferenciales separados.
El exit del CLI libera recursos del proceso, pero no demuestra que Window y
Document se recolectaran dentro del entorno. No inferir ausencia de fugas,
heap retenido o RSS pico a partir del tiempo total o del exit.

Este nuevo entregable no reemplaza ni acepta los presupuestos de operaciones
anteriores y no autoriza cerrar ownership, mergear o crear un checkpoint.
