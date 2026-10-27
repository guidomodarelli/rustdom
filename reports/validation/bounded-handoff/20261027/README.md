# Publicación acotada de informes mientras termina el piloto

Se calificó `tools/evidence-transport/metadata.py` para publicar resultados
finales sin descargar todos los originales del piloto al Git compartido de
Windows. La extensión solo permite insertar una sección en HANDOFF; las
partes ZIP continúan bajo el recolector secuencial ya revisado. No cambia
runtime DOM, core del transporte, captura, paquetes ni presupuestos.

La operación real publicó **2af1c196d7fc8f530f0864b0370e97a40f1fc64f**,
hijo único de aee07fde. Modificó exclusivamente
`reports/progress/HANDOFF.md` y preservó exactamente sus 418.075 bytes
anteriores. El documento nuevo tiene 420.235 bytes y SHA256
`88391482c5234de68ddbcb1074acefebae52f746ff92bd0375c6d7f9a2fe4d8a`.

El segundo clon autenticó ese documento desde el remoto. Ambos clientes
temporales tenían únicamente ese blob pequeño, con snapshots de repositorio
de 1.337.087 y 1.303.578 bytes. Solo después de la lectura independiente se
retiraron los dos clones propios. No se habilitó hidratación de benchmarks,
force-push, reintento automático, GC ni limpieza del Git compartido. Se importó
localmente solo ese commit de metadata mediante fetch normal sin filtros.
El pack temporal previamente bloqueado no cambió.

Pasaron siete contratos en Windows Python 3.12.10 y Linux Python 3.10.12:
documento real, CRLF previo, límites, entradas inválidas y recibos exclusivos.
Con Git real se rechazaron diez casos: ordinal, parent y OID no canónicos,
SHA incorrecto, autor inválido, credencial en sección/autor, OID/contenido que
no coinciden con el padre y blob residente no declarado. El cliente seco
sin publicación quedó retenido como evidencia; no se simuló una confirmación
para borrarlo. La publicación volvió a ejecutar los siete guardias anteriores
a cualquier operación remota. Los 79 procesos supervisados terminaron sin
descendientes propios pendientes.

`receipts.tar.gz` conserva 284 archivos, incluidos ambos drivers tal como se
ejecutaron, todos los comandos/stdout/stderr/estados de procesos, el cliente
seco, los inputs independientes, la revisión previa y la importación local.
`inventory.json` autentica cada miembro; se verificó leyendo el archivo de
nuevo. `sync-driver.py.txt` preserva además el lector actual de importación.
No ejecutar código archivado. `validation.json` mantiene los resultados
completos y `frozen-source.json` verifica HEAD4196 limpio, 903 entradas del
método, el paquete fb y los hashes/versiones de ambos SDK.

El módulo e3c08f90 y lock4667b6ab recibieron revisión aislada sin hallazgos antes
del push. Core lock89dd1849 y collect36e2cd0e siguen idénticos. Esta extensión
Python se probó con su operación Git real; no requiere nuevas mediciones DOM
ni una reconstrucción del addon. Los dos lectores Node de los datos del
criterio 0 ya habían pasado antes de este cambio y no se presentan como tests
del nuevo código Python.

Los tamaños publicados son snapshots de almacenamiento, no memoria pico ni
un certificado de ausencia de fugas Rust. Ver también
`reports/memory/bounded-handoff/20261027.json`. El piloto40426500725 sigue
en curso y conserva `performanceAccepted=null`/`gateReevaluated=false`.
Los dos checks de ownership siguen rechazados: esta publicación prepara
su análisis final y no los vuelve verdes. Sin tag/merge de ownership; objetivo
general activo y runtime híbrido. Se preservaron las 48 entradas ajenas.
