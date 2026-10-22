# Verificación del mapa de fuentes construidas

En Node 22.12.0 y 24.14.1 pasaron tres contratos reales por versión:

- Generar las 531 correspondencias contra jsdom independiente y A0/C físicos.
- Rechazar una copia de referencia cuyo strings.js fue alterado, antes de escribir.
- Rechazar una salida ya existente y conservar sus bytes.

Las dos salidas finales son idénticas. Se verificaron todos los hashes originales
contra reference.json y todos los archivos construidos contra el modelo de copia
más la inyección local de require. El resultado separa los 473 archivos JS con
texto conservado, 55 reescritos y tres datos, sin clasificar su migración ni
su alcance de ejecución.

El verificador congelado de preparación pasó antes y después en ambos Node;
cada identidad recalculada coincide con `preparation-receipt.json`. A0/C son
los paquetes del artefacto 12400802735, con sus hashes diferentes de addon y
sus fuentes/payloads fijados. No se recompiló ni ejecutó el addon.
Los scripts de build oficiales coinciden en bytes con el del proyecto usado
para describir la transformación. `source-fixture.json` conserva sus hashes.

`evidence.tar.gz` conserva el método, catálogo usado, ambas salidas y los logs
de contratos/autenticación. El tar no duplica los paquetes enteros: su origen
es el artefacto oficial ya versionado con ownership. `receipt.json` fija su
hash y los contadores; no es una aprobación de rendimiento del motor.

El mapa publicado está en `reports/progress/inventory/runtime-correspondence.json`.
No cambia el denominador ni los cinco módulos/catorce anclas auditados.
El motor y los tests de DOM no se modifican en este incremento. Esta rama
permanece separada hasta cerrar el hito prioritario de ownership.
