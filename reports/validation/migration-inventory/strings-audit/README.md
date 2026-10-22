# Auditoría de strings: validación

La referencia sigue siendo jsdom 27.4.0. Se revisó el módulo completo y sus
trece anclas ejecutables, clasificadas como pendientes de migración. Hay cinco
módulos y catorce anclas auditadas; no cambia ningún denominador ni se agrega
crédito Rust. Los registros de las 4.374 APIs permanecen idénticos.

Pasaron doce pruebas por Node 22.12.0 y 24.14.1 sin exclusiones: once contratos
del inventario y un contrato público diferencial con múltiples observaciones.
Este último usa jsdom independiente y el paquete real A0, con nombres no ASCII,
sanitización de controles HTML, colores, prefijos numéricos, whitespace y tokens.
No demuestra que las trece funciones tengan cobertura exhaustiva ni conformidad
normativa; no se cambió el producto para hacer pasar las pruebas.

`evidence.tar.gz` contiene las 208 fuentes verificadas, comandos, logs y los
catálogos completos generados por ambos Node. `receipt.json` fija su hash.
Las fuentes y anclas originales permanecen byte a byte idénticas al catálogo
anterior; classification/summary coinciden entre Node. El archivo surface completo
contiene el perfil de Node y exclusiones ECMAScript distintas (92/96); por eso
no es idéntico entre versiones. Las APIs, constructores y las demás dimensiones
observadas sí coinciden. `comparison.json` conserva la distinción.

`reference-and-built.json` y `strings.diff` conservan los hashes y la única
diferencia observada entre referencia y archivo construido: el adaptador local
de require. A0/C son los paquetes oficiales del artefacto 12400802735, ya fijados
para ownership. No se reconstruyeron ni modificaron, ni se tocó su ensayo activo.
Las clasificaciones describen esa ruta JavaScript real, no solo la existencia
de primitivas parecidas en Rust.

Las dependencias físicas del fixture Linux se copiaron de la validación anterior,
incluido TypeScript 5.9.3; se conservaron versiones y fuentes. El contrato público
adicional usa `RUSTDOM_PUBLIC_PACKAGE_ROOT` apuntando a A0 y cierra ambas ventanas.
La memoria del generador se registra aparte; no se infiere de cerrar esas ventanas
que el nuevo fixture público tenga una prueba exhaustiva de retención.

Los benchmarks del CLI están en `reports/benchmarks/migration-inventory/strings-audit/`
y los ciclos de GC en `reports/memory/migration-inventory/strings-audit/`.
Esta rama se mantiene separada hasta cerrar el hito prioritario del PR #80.
