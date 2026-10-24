# Recursos al preparar la extracción

Este cambio añade configuración y un adaptador de transporte; no modifica Rust,
el addon ni ownership de Window/Document. No ejecuta DOM ni el sampler. La carga
del lector usa bytes actuales del repositorio autenticados antes de compilar;
ningún script extraído del ZIP/tar se importa o ejecuta.

El lector reutilizado procesa archivos con context managers. El extractor seguro
mantiene un manifiesto de miembros y hashes; ese uso de memoria depende de la
cantidad de miembros y no constituye una medición de memoria pico. Cada prueba
usa un directorio temporal propio y verifica su ruta resuelta antes de eliminarlo.
Rechaza destinos existentes y conserva datos ajenos. Los temporales de extracción
no reemplazan ni borran los archivos originales de evidencia.

Linux completó seis contratos, incluida la lectura integral de la referencia
histórica bajo su propia identidad y rechazo. Windows pasó cinco y omitió ese
caso solo después de confirmar que faltaban privilegios para enlaces. El caso
real con enlaces fue cubierto en Linux. Los dos archivos históricos conservaron
exactamente sus SHA-256 después de toda la QA.

No se midieron RSS/heap ni memoria pico del extractor. Estas pruebas finitas y
la revisión de cierre de handles no demuestran ausencia universal de fugas.
Los recursos del runtime de la captura 40137458635 siguen pendientes de su
archivo auténtico y del replay estricto; no sustituirlos por esta preparación.
