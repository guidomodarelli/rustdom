# Componentes nativos del transporte científico

El receptor actual autenticó los33ZIP del intento consumido40366685759:
408198146bytes, metadata API y33logs íntegros. Los64replays con Node22.12.0 y
24.14.1 conservan complete=false, reason=no-index y analysis=null. El lector
ejecuta código actual revisado; no ejecuta código archivado ni workers DOM.
Esto reproduce el fallo histórico de preparación y no completa sus muestras.
El source real del lector permanece4196c496; la captura antigua dice1078e4fd.
No se normalizaron ni falsearon esas procedencias distintas.

La publicación nativa del ZIP existente111209731bytes (artifact12688150146,
run40395417183, intento1) produjo cuatro partes de32MiB o menos, lectura remota
independiente y hash conjunto idéntico. Los ocho Git descartables se retiraron
solo después de confirmar su publicación. Commit final de esas partes:
c25901a6af14062cc213791addc4a16200af9e15. No reintentos de mutaciones inciertas.
Sus bytes siguen bajo roundtrip/; esta preservación no los vuelve a stagear.

Pasaron31pruebas reales de metadata/ZIP y seis controles de carga. Se cerraron
dos P2: destinos dentro/encima del source y uso de bytecode cacheado distinto
del source autenticado. El loader verifica siete pins (incluidos policies y
lock) antes de compilar los mismos buffers; una fixture .pyc válida e inocua
demuestra que el import estándar ejecutaría el reemplazo y el loader lo ignora.
La fixture cacheada se archiva como .bin, solo datos. No es un mock de SDK.

El primer lector falló antes del primer ZIP porque gh2.103.3 rechazó ANSI de
un log. El fix agrega --allow-escape-sequences únicamente al GET de logs;
stdout siempre va a archivos supervisados y nunca se muestra en la terminal.
La raíz fallida y sus fuentes congeladas se conservan. El primer intento de
tests de metadata usó .cache sin sus ZIP ya retirados; el posterior usa los
originales publicados. No se presenta ese intento incompleto como prueba pasada.

Un fetch filtrado en el Git compartido Windows intentó repack de vínculos
locales y llenó C:. La revisión automática bloqueó borrar tmp_pack_IyiPK4;
sigue intacto y no se reintentó. Se recuperó espacio con sparse checkout de
65copias limpias versionadas (812492330bytes), verificadas en SHA256 y Gitblob,
sin intersección con903entradas del método. Los originales siguen en Git/remoto.
Los cuatro blobs QA se importaron de forma acotada y verificada sin otro fetch;
los dos flags transitorios de origin se restauraron. No se borró ningún pack
permanente ni objeto Git. El directorio tools/evidence-transport queda incluido
en el sparse de la rama de datos para conservar sus módulos físicos.

evidence/export-inventory.json referencia por tamaño/SHA/Gitblob los ZIP/tar
duplicados que ya están íntegros en4196. Los demás journals, resultados,
parciales, fuentes y controles se guardan byte por byte. source-invariants.json
vuelve a verificar902fuentes,903bindings de publicación y850pins históricos;
autentica el recibo por separado. readers-as-run es
auditoría; para operar usar código actual revisado, nunca programas archivados.

Esta evidencia califica componentes y el transporte de una campaña fallida.
Falta conectar/probar el coordinador secuencial de colección, publicación y
replay completo por criterio para la captura v2; no afirmar que ya está listo.
No se aplicó etiqueta ni se ejecutó captura nueva. El CI sigue77/79; ownership
mantiene el rechazo histórico. No acepta rendimiento Rust ni mide memoria pico
del DOM o ausencia universal de fugas. Sin tag ni merge. Runtime híbrido y
migración general pendiente; conservar48entradas ajenas y autorización permanente.
