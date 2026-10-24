# Validación offline de sensibilidad

Se ejecutaron diez tests en Windows Python 3.12.10 y Linux/WSL Python 3.10.12:
siete numéricos y tres contratos con copias reales de los datos archivados,
sin mocks. Los contratos rechazan omisión de una observación, identidad
duplicada y eliminación de una fila del resultado de referencia.

El programa leyó las 32 filas de control y las 9.216 duraciones originales,
reprodujo sus 32 deltas nominales y calculó 512 escenarios. Las dos plataformas
produjeron bytes idénticos a `control-sensitivity/result.json`. Los tres inputs
coinciden con los bytes publicados en `58650e58`. Comandos, salidas y códigos
de proceso están en `checks.json` y los ocho logs contiguos.

Este diagnóstico no autentica por sí solo el archivo original: esa obligación
continúa en los verificadores congelados y sus recibos publicados. Tampoco
calcula confianza estadística, potencia o un nuevo tamaño de muestra. No
reinterpreta la aceptación ni selecciona un escenario favorable.

Las estructuras del lector son finitas (32 grupos de control y sus muestras);
no crea objetos DOM, callbacks persistentes, caches globales o recursos N-API.
No hay nuevos escenarios ni mediciones de memoria. Los informes existentes
de memoria conservan su alcance y límites.

No cambió código de producto. Las suites Rust/Node22/Node24, Jest, Vitest y
corpus no se repiten para este postproceso Python; el CI del SHA que publica
el cambio se controla por separado. Ownership continúa sin aceptación y el
inventario de migración no recibe crédito nuevo.
