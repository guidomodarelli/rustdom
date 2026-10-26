# Preparación del calendario prospectivo

Pasaron seis contratos en cada combinación Windows/Linux × Node22.12.0/24.14.1.
Los SDK se autenticaron por versión y SHA antes de ejecutarlos. Se conservan
stdout/stderr íntegros, QA y cuatro calendarios completos gzip con el mismo SHA
de bytes descomprimidos:
`6e6c0daf78493567b9ad8723b6ea3d09ea59d33821f05a68163ccb9a69b5fc9a`.
Las pruebas iniciales de cinco contratos previas a agregar la CLI permanecen
separadas; no se cuentan como la validación final de seis.

Se reprodujo el workflow funcional en un Git Linux real de inputs actuales,
sin usar el gitfile Windows ni atribuir al fixture un commit publicado.
Fixture `691077751e9270d2c6926e9f1a87b0b644730ae3`: 816 archivos fuente,
checkout no-cone inicialmente mínimo y materialización por el helper revisado.
Las cinco órdenes del job pasaron: checkout, seis contratos Node22, calendario
Node22, seis contratos Node24 y calendario Node24. Todos los archivos
materializados conservaron sus bytes; Git terminó limpio. El manifiesto de
fuentes, calendarios y logs completos están en `sparse/`.

actionlint aprobó el workflow nuevo. **El run hosted nuevo sigue pendiente de
publicación/ejecución**: el fixture local no sustituye esa confirmación.

Los 786 pins históricos se verificaron íntegros en Linux, con digest417b3e7e y
recibo8f21aa40. Un intento adicional del lector histórico en Windows falló por
su comprobación de identidad stat entre path/descriptor antes de hashear; se
conserva el stdout vacío y un resumen identificado como tal del error observado.
No se modificó ese lector congelado para omitir la comprobación. Este intento
no fue un fallo de los contratos nuevos ni una captura de rendimiento.

Los datos usados para comprobar aritmética son sintéticos. No hubo DOM,
duraciones reales, compilación Rust, instalación ni secuencia científica.
`performanceAccepted=null`, `gateReevaluated=false`, `executionReady=false`.
Continúan pendientes intervalos, capturador, transporte, tareas/recursos y
autenticación integral. No tag/merge; los rechazos históricos se conservan.
