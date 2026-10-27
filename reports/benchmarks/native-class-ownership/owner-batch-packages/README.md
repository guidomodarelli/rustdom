# Paquete autenticado del candidato con owners agrupados

artifact.py exige el run 40205226009, intento 1, fuente db348de1, los seis jobs
aprobados y los seis ZIP originales. Verifica cada calificación de 24 comandos y
selecciona exclusivamente Ubuntu/Node22, artifact12604810857: ELF4b52a84d. Preserva
sourceCommit=f781c3b7, los cambios Git reales y sourceGitErrors sin normalizarlos.

assemble.py reutiliza los verificadores actuales de controles y fuentes. Copia
los 577 archivos del runtime hospedado sin instalar ni reconstruir. Los 346
inputs canónicos coinciden con la fuente anterior más el patch publicado cb784c2f.
El Git de esa reproducción local se distingue de la calificación del compilador
hospedado. scripts/build.mjs falta bajo el checkout compilador del ZIP; existen
dos copias en fixtures y la fuente canónica local, todas con el hash declarado.
No se atribuyen las fixtures al compilador ni se afirma reproducibilidad del ELF.

El tar completo está en reports/validation/owner-batch-package/20261025/. Sus
7.823 miembros bajo el directorio raíz y seis enlaces internos están fijados por
un manifiesto externo; el tar tiene 7.824 entradas contando ese directorio raíz.
transport.py verifica todos los bytes, tipos y targets antes de extraer. Rechaza
sobrescritura, paths desconocidos y archivos debajo de enlaces; escribe miembros
físicos antes de crear links internos y vuelve a comprobar el archivo al terminar.
Nunca ejecuta scripts del archivo. El paquete debe extraerse fuera del checkout
Git para preservar la identidad real del snapshot de fuentes sin repositorio.

manifest.cjs verifica las distribuciones y prepara roots para procesos funcionales;
no sustituye la autenticación previa de transporte/ensamblado. El workflow nuevo
realiza esos pasos antes de ejecutar las pruebas en ambos Node, sin compilar Rust.

Pasaron cuatro contratos de lectura en Windows y Linux, tres de transporte en
Linux y dos más una exclusión explícita de extracción Linux en Windows, cuatro de
ensamblado por SDK y verificación de la reconstrucción real con ambos Node. Las
pruebas iniciales de ensamblado agotaron /dev/shm al duplicar dependencias en
paralelo; se conservan logs íntegros comprimidos. El setup corregido usa corrupción
reversible bajo lock exclusivo sobre el ensamblado nuevo del agente, restaura los
bytes exactos y no modifica controles históricos ni los archivos originales.

La creación inicial del tar comparó orden de Path con orden de strings y salió
con AssertionError. Se conservó ese mismo tar: el recálculo por mapas comprobó
igualdad de todos sus miembros después de restaurar los tests negativos. No se
regeneró ni se ejecutaron muestras por esa comprobación.

Estos lectores no deciden rendimiento. La captura científica sigue deshabilitada;
faltan capturador/replay integral, calificación y revisión del método completo.
