# Controles independientes del candidato combinado

Se copiaron y autenticaron A0/A1/J0/J1 y las dependencias originales, sin incorporar
B, cargar DOM/N-API, medir, instalar o recompilar. El archivo histórico y sus599pins
se contrastan con la identidad original. baseline-index.json.gz conserva hashes y
la metadata Git real del snapshot: commit=null y errores128. La procedencia del
compilador original se registra aparte; no se inventa un checkout limpio.

qa.zip conserva la primera ejecución de cinco contratos por SDK. La revisión
aislada detectó un P2: podía aceptarse un hardlink de bytes idénticos entre controles.
qa-after-review.zip conserva el código corregido y seis contratos aprobados en
Node22.12.0/24.14.1, incluida la regresión real de inodo compartido. Los manifiestos
permiten comprobar cada miembro. No ejecutar scripts archivados.

El candidato sigue pendiente de la matriz funcional completa y del artifact
Linux/Node24 preseleccionado del run40168321423. No se ha fijado/activado un estudio,
aceptado rendimiento ni reevaluado los rechazos históricos. Runtime híbrido;
migración general pendiente. Sin tag/merge de ownership.
