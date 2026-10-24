# Recursos del lector de transporte

Este cambio añade un cliente de lectura y conserva evidencia del run 40137458635;
no cambia Rust, el addon, wrappers DOM ni sus relaciones de ownership. El lector
no crea Window/Document, no ejecuta el sampler y no interpreta código del tar.

Los handles de archivos/ZIP del lector reutilizado se cierran con context managers.
Cada CLI termina tras una consulta o colección; no hay daemon ni cache nativa.
El módulo Python actual se autentica y configura por invocación. GH_REPO se
restaura en finally, incluso cuando falla la validación de una salida. Los
snapshots adicionales retienen intencionalmente evidencia en disco, sin sobrescribir
los anteriores. No se midió RSS/heap ni memoria pico de este cliente, y la revisión
estática y las pruebas finitas no prueban ausencia universal de fugas.

Ocho contratos reales pasan en Linux; Windows pasa siete y omite solo la creación
de symlink por privilegio ausente. Linux cubre ese enlace y comprueba que el
rechazo no escribe snapshots en su destino. Las pruebas también verifican
preservación de datos ajenos, ownership de salida y restauración del entorno.
No usan mocks de DOM, GitHub ni librerías de plataforma. La metadata API real
posterior a un push conserva la fuente inmutable del run y se acepta correctamente.

Los recursos del runtime y las duraciones del estudio siguen pendientes de la
captura completa y su replay estricto. No sustituirlos por esta QA de transporte
ni por los 82 reportes de memoria del CI general. Se conservan límites, rechazos,
presupuestos y toda la evidencia histórica de ownership.
