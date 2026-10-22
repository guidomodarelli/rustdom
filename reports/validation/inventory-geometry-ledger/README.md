# Calificación de las 42 clasificaciones de geometría

Linux22.12.0/24.14.1 y Windows22.12.0/24.22.1 pasan doce contratos por versión.
Se ejercen el CLI, el jsdom independiente real, contratos DOMRect y el cierre
de owners; no se ejecuta el addon ni se implementa runtime nuevo.

`qualification.tar.gz` conserva 204 archivos, incluidas 76 fuentes congeladas,
ambos catálogos Linux completos, logs Windows, procesos, resultados de memoria,
herramientas, fuentes de preparación y errores históricos. `raw-files.json`
permite verificar cada miembro; receipt.json guarda SHA-256, tamaño, readback,
recuentos y diferencias de host. Las 13510 dependencias del árbol Linux
reutilizado se cotejaron con su manifiesto histórico. node_modules se omite del
tar: reconstruir desde el lockfile incluido y contrastar el manifiesto.

Las 42 auditorías previas y los 12151 IDs no cambian. Los denominadores siguen
531/4374/7246. Referencia, anclas, clasificación y resumen coinciden en bytes
entre ambos Node. Coinciden también todos los registros API y declaraciones
incluidas. El perfil Node y las exclusiones de SuppressedError, DisposableStack,
AsyncDisposableStack y Float16Array difieren como permite el contrato original:
son globals ECMAScript excluidos, no APIs retiradas del alcance para pasar.

Se conservan los fallos: setup Windows git.exe con ruta WSL, timeout de30s
del CLI sobre NTFS montado, un primer snapshot sin package.json y dos supuestos
incorrectos del verificador (igualdad total de perfiles y reporter TAP en Node24).
Todos los comandos del snapshot final terminaron con exit0. El verificador
offline se corrigió sin cambiar producto, tiempos límite o repetir los tests.

Los archivos Node22 del directorio superior corresponden al intento sobre
NTFS, incluido el fallo; no deben confundirse con la calificación Linux local
aprobada, conservada en el tar. No hay aceptación de rendimiento, porcentaje
global de migración ni checkpoint del hito ownership en esta auditoría.
