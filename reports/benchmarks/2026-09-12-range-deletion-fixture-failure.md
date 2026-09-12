# Corrección del arnés de benchmark

La primera ejecución de `npm run bench -- range-delete-contents range-stringify-1`
terminó en la validación de jsdom con `AssertionError: 2 !== 250`.
La comprobación genérica exigía conservar todas las filas, mientras que la
carga nueva elimina las filas intermedias y debe dejar dos. Se ajustó esa
expectativa únicamente para `range-delete-contents`; las demás operaciones
conservan la cantidad original. No se cambió la implementación del DOM.

El fallo ocurrió antes de completar las muestras comparables y no se publica
como resultado de rendimiento. La siguiente ejecución conserva sus muestras
y comprueba además texto, colapso y hash del documento completo.
