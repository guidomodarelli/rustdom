# Ejecución única ya activada

Run `40184510898`, job `121142337986`, intento 1, fuente `95e64bd20711975b08864cf1bef1dee362b79663`.
`latest.json` es un snapshot fechado de captura activa; no es el resultado final.
El plan tiene 2.048 procesos y no se conoce aún su conteo completado. El artifact
científico no estaba disponible al guardar este checkpoint. La aceptación sigue
null y el gate no se reevaluó. No reaplicar la etiqueta ni relanzar la secuencia.

`binding.activation.json` fija run/job/fuente/recibo y digest desde metadata API
independiente, antes del artifact. No modificarlo. Al terminar, producir un
binding.results.json separado con artifact ID, tamaños y hashes autenticados,
manteniendo todos los campos originales inmutables.

El intent se escribió antes de la única aplicación de etiqueta; su campo
measurementProcesses describe el plan prospectivo, no procesos ya observados.
La operación requirió CI 40183945744 aprobado en ambos SDK y revisión del SHA
publicado sin pendientes. La revisión del operador cerró dos defectos: rechazar
Python optimizado antes de toda escritura y revalidar HEAD/PR/ausencia de etiqueta
inmediatamente antes de crear intención y aplicar. Ambas comprobaciones fueron
ejercidas con intérpretes reales o metadata real; no se simuló una captura válida.

observations.zip conserva 18 miembros, incluyendo metadata original y copias de
scripts consumidos para auditoría. Sus tamaños y SHA están en receipt.json.
No ejecutar esos scripts ni importarlos desde el archivo. Usar exclusivamente
los lectores actuales versionados en combined-process-study/. El transporte no
ejecuta DOM ni repite mediciones; conserva descargas yTAR interrumpidos.

Método y paquete quedan congelados durante esta ejecución. Un fallo de observación
no es un resultado terminal. El final, aun rechazado o parcial, debe conservarse
íntegro y analizarse en ambos Node oficiales. No hay tag/merge ni integración de
ownership sin una decisión completa y la validación correspondiente.
