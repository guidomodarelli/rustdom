# Receptor incremental de evidencia

`tools/evidence-transport/` mantiene los helpers Linux/Git revisados y recibe
archives sin cargarlos completos en RAM. Verifica ELF, grafo del supervisor,
salidas exclusivas, endpoints GET de artifacts, tamaños, stderr y deadlines.
El padre consume cancelaciones diferidas y recolecta hijos/nietos por PID e
identidad de inicio. Git agrega una sola ruta mediante árboles, sin índice ni
hidratar el árbol padre. No reintenta mutaciones remotas inciertas.

La suite final aprobó16casos con HTTP y CLI reales, ZIP existentes104325 y
111209731bytes, timeout, límites exactos, duplicados y señales15/2. Se corrigió
el fallback de credenciales: las fixtures locales exigen cuatro tokens dummy.
La regresión conserva hosts.yml sintético con providers ausentes y rechaza
antes de iniciar el cliente. La lectura autenticada de GitHub reprodujo el
original104325bytes/SHA4919d664, sin persistir la credencial. Cuatro guards de
-O/PYTHONOPTIMIZE pasaron sobre el código actual. Revisión aislada sin hallazgos.

Se conservan también el fallo inicial del timeout demasiado corto y v3
cancelado cuando un clone Git quiso empacar el origen parcial. La fixture
actual usa Git init/alternates y no empaqueta el origen. Las épocas v2/v4 son
intermedias, no muestras independientes ni nuevas mediciones del producto.
Solo los snapshots de fuente realmente congelados se publican como tales.

`evidence/export-inventory.json` incluye cada archivo de QA. Los buffers grandes son
copias idénticas del ZIP ya publicado en ci-4196c496/artifacts/contracts/12688150146;
se referencian por tamaño/SHA/partes, sin duplicar111MB por prueba. Los Git de
fixture locales derivados tienen inventario; no son originales científicos.
Los demás journals, parciales y resultados se conservan byte por byte.

RSS del padre Python final:23330816→24891392bytes de high-water durante la
transferencia111MB. No mide el total del cliente, Rust/V8 ni memoria pico DOM,
ni demuestra ausencia universal de fugas. No ejecuta scripts archivados o DOM.
Estos resultados no califican la colección científica completa de33artifacts:
scientificCapturePreservationQualified=false, etiqueta v2 aún sin aplicar.
CI sigue77/79, ownership conserva el rechazo histórico. Sin tag ni merge.

La revisión corrigió cinco referencias de procedencia del buffer grande: el
artifact12688150146 pertenece a contratos/run40395417183. Se conserva el
inventario original en evidence/export-inventory-as-exported.json y metadata
API que confirma la corrección; bytes/SHA del original no cambiaron.
