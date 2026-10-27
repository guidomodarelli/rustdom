# Recursos de DOMImplementation en el baseline A0

Cada SDK oficial ejecutó doce ciclos: tres por combinación de engine jsdom/rustdom
y realm default/VM, tras warmup. Cada ciclo retiene 100 documentos, comprueba sus
resultados públicos y libera las referencias. Se observan Window, documento
propietario, DOMImplementation, documentos creados, doctypes y errores por separado.
Los endpoints alcanzaron liberación y coincidencia de contadores con el baseline
nativo en los escenarios ejecutados. El contador de llamadas activas volvió a cero.

node22.json y node24.json son los reportes originales completos. La QA conserva
comandos, SDKs fijados, fuente y paquete A0 auténticos. Las cuatro fuentes auditadas
son idénticas al baseline; estos datos no califican el guard ni el candidato de
Range nuevo. No se reconstruyó el paquete y no se modificó la captura científica.

Son observaciones finitas después de GC y con referencias retenidas deliberadamente.
No representan memoria pico ni prueban ausencia universal de fugas. No se mezclan
con las muestras ni con la aceptación de rendimiento del estudio de 2048 procesos.
