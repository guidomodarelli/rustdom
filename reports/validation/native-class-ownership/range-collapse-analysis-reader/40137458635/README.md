# Preparación del análisis offline

El verificador de la fuente 02291d6b decide sobre el run completo 40137458635.
El exportador no cambia el estimador, los presupuestos ni la aceptación. Antes
se exigen Git Linux real/limpio en ese SHA, recibo 83ef931b y 563 archivos exactos,
Node versión/hash fijados y lectores de recursos/CSV autenticados. El destino
queda fuera de la captura y del checkout de fuente. No se ejecuta DOM ni código
extraído del archivo; no se normalizan identidades ni errores Git.

QA final: 12 contratos por Node 22.12.0/24.14.1. Los datos son la referencia REAL
40113188886, fuente b63cf834 y rechazo original: 24576 filas de warmup/medidas
coinciden byte por byte con su CSV guardado, los totales de recursos coinciden
con su JSON y permanecen las 32 comparaciones, 8 controles jsdom desfavorables y
1 regresión numérica. La referencia completa se rechaza como el run nuevo antes
de escribir. Los casos negativos ejercen Window/Document independientes,
baseline nativo, alias de salida, checkout de fuente y recibos/bytes alterados.

Se preserva attempt1 con 9 aprobados/1 fallido: el test esperaba 16 grupos físicos,
pero los datos reales contienen 18 porque AB distribuye el control entre A0/A1.
Se corrigió la expectativa del test, sin cambiar datos ni método. attempt2
preserva 10 aprobados por Node; attempt3 suma la autenticación previa de las 563
fuentes y sus negativos,12/12 por Node. En AB cada Node conserva 64 procesos A0,
64 A1 y 128 B; la separación de grupos no modifica los estimadores.

El CLI positivo sobre el artifact NUEVO, su decisión y la comparación de los
cuatro exports finales entre Node siguen pendientes del archivo auténtico.
Este cierre prepara lectores; no acepta rendimiento, tag ni merge de ownership.
