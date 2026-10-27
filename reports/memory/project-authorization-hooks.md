# Recursos de los hooks de autorización

El cambio instala un proceso Python de contexto por evento. No cambia el
ownership de Rust, los wrappers N-API ni los objetos Document/Window del DOM.
La captura de rendimiento en curso conserva sus 511 pins y su método.

El hook lee como máximo 1 MiB de stdin y produce un mensaje fijo. No consulta
transcripts, conserva argumentos, inicia herramientas ni crea caches, timers,
listeners o conexiones persistentes. El proceso termina tras responder.
Estas son propiedades del código revisado, no una medición de memoria pico.

Las pruebas funcionales ejecutaron doce invocaciones repetidas por plataforma
y comprobaron que no cambian los archivos de instalación/configuración. Siete
invocaciones adicionales del hook instalado real mantuvieron sus archivos
intactos. Las entradas grandes y los proyectos fuera de alcance producen una
respuesta vacía; no se reflejan los argumentos ni secretos de la herramienta.

No se midieron RSS, heap máximo ni retención del allocator del intérprete.
Estas comprobaciones finitas no prueban ausencia universal de fugas. Los
resultados y límites de la prueba de recursos del DOM se mantienen separados
en los informes del estudio de ownership.
