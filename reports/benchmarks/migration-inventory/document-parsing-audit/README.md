# Costo del CLI con XML y construcción auditados

Se midió el CLI real `npm run inventory -- --output ...` después de corregir la
clasificación. Son dos warmups y cinco procesos medidos nuevos por Node
22.12.0/24.14.1: catorce procesos, todos con exit 0 y cada catálogo idéntico a
los digests validados para su Node. No hubo reintentos ni selección de muestras.

| Node | Mediana del comando completo | Máximo RSS informado por GNU time |
| --- | ---: | ---: |
| 22.12.0 | 4.929,800 ms | 233.064 KiB |
| 24.14.1 | 3.625,401 ms | 278.240 KiB |

Incluye arranque npm/Node, lectura, AST, observación de APIs, clasificación,
serialización y escritura. El fixture final tiene 230 fuentes verificadas,
dependencias físicas y un enlace al dist oficial A0. El CLI observa jsdom
independiente y no carga ese addon. El script, muestras, logs, hardware
WSL/i7-1360P, versiones y recursos se guardan completos. npm 11.11.0 y
TypeScript 5.9.3 se observaron después. Las fuentes permanecieron estables.

La observación anterior HTML fue 4.378,476/3.875,397 ms: en esta ejecución
Node22 fue mayor y Node24 menor. No son contrastes controlados entre versiones
del tooling; no se atribuye mejora o regresión a la nueva auditoría. Tampoco
se miden aquí parsing, factories o costo N-API, ni se aceptan sus presupuestos.
Los costos históricos de DOMImplementation siguen documentados por separado.

El máximo RSS del comando informado por GNU time no es memoria simultánea
sumada de sus procesos, heap retenido ni memoria del addon. No se clasifica
como fuga o retención del allocator. El timeout de treinta segundos no cambió.
