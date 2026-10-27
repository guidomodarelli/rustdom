# Validación del catálogo y auditoría de MutationRecord

Node 22.12.0 y 24.14.1 aprobaron ocho contratos cada uno y el CLI real. Las
clasificaciones, los recuentos, la referencia y las anclas coinciden entre SDK;
las diferencias reales de globals ECMAScript excluidos permanecen en surface.
El catálogo registra ocho módulos, 47 APIs y nueve anclas auditadas. Ninguna
de las 14 filas nuevas está clasificada como Rust completo.

La vista física usa fuentes reales de la propuesta y una copia byte a byte de
jsdom 27.4.0; reutiliza dependencias instaladas reales mediante enlaces locales.
No es un checkout Git, no normaliza identidad Git ni modifica SOURCE4196.
Los contratos ejercen descriptores, herencia, cookies, grafo, validación de
auditorías, reproducción, locales, liberación de owners y clasificación híbrida.
No hay mocks de plataforma ni nuevas pruebas de rendimiento del DOM.

Se preservan los intentos adversos: el primero alcanzó 180 segundos usando
dependencias desde NTFS y su arnés no guardó los buffers parciales; la vista
fuente sigue registrada. La siguiente vista Linux aprobó siete contratos y
falló el control de memoria por un helper omitido de la copia. La vista final
incluye el helper real sin cambios y aprueba todo en ambos SDK. No se excluyó
el control ni se relajaron sus expectativas. Son épocas funcionales distintas,
sin pooling ni captura científica repetida.

qualification.tar.gz conserva 1.342 archivos regulares y el inventario registra
515 enlaces a dependencias prestadas sin seguirlos ni archivarlos. Cada archivo
incluido tuvo segunda lectura y verificación de hash. Están los TAP completos,
salidas CLI, recibos de supervisión, catálogos, vistas fuente y lectura de feedback
real del PR. La primera época tiene el límite de logs descrito arriba. Nunca
ejecutar código archivado; usar las herramientas mantenidas del repositorio.

Los controles de memoria directos de tres ciclos por SDK retienen tres reportes
escalares y observan cero Window y Document supervivientes en dos estados claros.
Sus datos están en reports/memory/inventory-mutation-record-audit/20261027.json.
Cubren la herramienta y el jsdom independiente, sin cargar el addon Rust;
no prueban memoria pico ni ausencia universal de fugas.

La lectura completa del PR encontró cuatro reviews, 40 comentarios generales
y cero hilos abiertos, sin solicitar otra review remota. Esto no acepta el
presupuesto de rendimiento. El piloto 40426500725 sigue independiente e intacto.

Para reproducir en un checkout completo de esta revisión, con cada SDK fijado:

```sh
npm ci
node --test tests/validation/migration-inventory.spec.mjs
node scripts/migration-inventory.cjs --output /salida/nueva
node --expose-gc tests/helpers/inventory-memory.cjs
```

La clasificación semántica necesita revisión humana/aislada además de contratos;
tests verdes del catálogo no demuestran que todos los algoritmos estén en Rust.
scopeClosed=false, migrationPercent=null. Runtime híbrido y objetivo activo.
