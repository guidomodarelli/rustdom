# Correspondencia física de las fuentes del runtime

`../runtime-correspondence.json` conecta los 531 IDs de archivo de jsdom 27.4.0
con su ruta real en `dist/vendor-jsdom`, hashes originales/construidos y el
resultado de aplicar únicamente el adaptador local de require del build.
Los `referenceModuleIds` de classification.json permiten enlazar APIs y anclas
a este mapa sin cambiar sus clasificaciones.

| Clase de fuente | Total | Coincide con la copia y el adaptador | Reescrita por el build |
| --- | ---: | ---: | ---: |
| JavaScript | 528 | 473 | 55 |
| Datos, incluido package.json | 3 | 3 | 0 |
| Total | 531 | 476 | 55 |

Se usaron A0 y C/B del artefacto oficial 12400802735, run 39720077911, con sus
paquetes ya preparados. Sus 531 archivos de referencia construidos son idénticos
entre A0/C. Eso no dice que sus addons nativos coincidan: son distribuciones
distintas y sus hashes se mantienen en el recibo oficial. No se reconstruyó nada.
El verificador congelado autenticó la preparación completa en ambos Node antes
y después de generar/medir el mapa. Los scripts de build de ambas fuentes
oficiales y de esta rama tienen el mismo hash.

**Este es un mapa de archivos, no una auditoría semántica ni de alcance de ejecución.**
Que un archivo conserve texto JavaScript no demuestra que todas sus funciones
sean alcanzables ni que sus dependencias no llamen a Rust. Que esté reescrito
tampoco demuestra que el módulo esté migrado: puede conservar decisiones del
host. Los bindings, datos y adaptadores no son algoritmos DOM equivalentes
entre sí. No se obtiene un porcentaje de migración de estas proporciones.

Cada fila conserva `reachabilityAudited=false` y `classificationApplied=false`.
No acredita más módulos/anclas completos: continúan cinco módulos y catorce
anclas con clasificación revisada, el alcance abierto y migrationPercent=null.
Las 4.374 APIs y 7.246 anclas no cambian. Las dependencias externas, propiedades
dinámicas y perfiles adicionales siguen siendo parte del trabajo pendiente.

## Reproducción

`compare.cjs` es el método ejecutado. Recibe cuatro argumentos posicionales:
catálogo reference.json, paquete independiente jsdom, directorio packages de la
preparación oficial autenticada y un archivo de salida nuevo. No carga ningún
motor DOM ni addon. Comprueba cada hash de referencia, conserva la salida previa
y verifica que las dos variantes construidas tengan el mismo contenido.

```text
node compare.cjs reference.json /reference/jsdom /prepared/ownership-build/packages /new-output/map.json
```

La preparación se autentica por separado con el verificador congelado y su
recibo antes de usar esos paths. El método no atribuye un ID de artefacto a
cualquier directorio que el usuario pase: el recibo de esta ejecución fija
los inputs específicos. Fuentes, salidas y validaciones están en
`reports/validation/migration-inventory/runtime-correspondence/` y las catorce
observaciones del CLI en `reports/benchmarks/migration-inventory/runtime-correspondence/`.
