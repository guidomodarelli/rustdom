# Verificación del hallazgo de rangos adyacentes

El comentario 3995495688 de la review 5185710728 afirma que el guard cambia
la reubicación de rangos anclados únicamente en Text que se eliminan. El código
de jsdom 27.4.0 consulta `node._liveRanges()` y `parentNode._liveRanges()` dentro
del bucle original; no consulta los rangos de `currentNode` allí. Si ambos sets
están vacíos, ese bucle no mueve extremos y `_remove` los reubica en el padre.

Se reconstruyó el addon y la copia privada de jsdom con el código de producción
exacto de `e8874f17d9b195df76e545a61ec94f8dd8f32fa4`. La reproducción compara
rangos sólo en el segundo Text, entre segundo/tercero, entre primero/segundo y
en el padre. En los dos primeros casos ambos motores dejan los extremos en el
padre, offset 1. En el caso primero/segundo, ambos los trasladan al superviviente.
Los JSON de Node 22 y Node 24 conservan los resultados completos.

Se agrega una regresión explícita que exige ese comportamiento en ambos motores.
No se modifica producción ni se presenta el comentario como un fix aplicado.
Esta compatibilidad con el jsdom fijado no afirma conformidad con un algoritmo
de navegador distinto ni cambia la prioridad de compatibilidad solicitada.

Los cinco contratos de `tests/normalization.spec.cjs` pasaron con Node 24.14.1
y Node 22.12.0. `native-build.json` conserva la identidad del addon reconstruido.
Los benchmarks y controles de memoria del head anterior se reutilizan porque
esta comprobación añade únicamente tests y evidencia, sin cambiar producción.
