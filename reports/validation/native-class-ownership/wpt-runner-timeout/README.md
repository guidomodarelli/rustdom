# Timeout del runner WPT

La referencia jsdom del CI macOS tardó 78,75 s en una fixture long de 60 s.
El aislamiento de procesos no lo resolvió. La nueva política usa la extensión
upstream para runners setup({timeout_multiplier:2}) en ambos motores, antes de
los casos. Conserva los bytes del corpus y sus assertions, compara TIMEOUT y
registra la configuración. Los límites externos son finitos: 150/180 s.
No modifica umbrales de benchmarks ni convierte el fallo original en paridad.

Once tests aprobaron en Linux Node 22.12.0/24.14.1 y Windows Node 24.14.1.
Incluyen timeouts globales reales de ambos motores: el archivo queda abierto
tras un caso aprobado y termina con TIMEOUT, usando timers reales. Se conserva
el rechazo de ambos registros macOS originales. Los tests también observan
terminación tras éxito/deadline, errores y preservación de evidencia.

El corpus completo pasó paridad en ambos Nodes: 240 fixtures, 83.007 resultados
y 1.203 fallos de estándares compartidos por versión. Exclusiones y bloqueos
siguen visibles; esto no acredita cumplimiento completo de estándares. Los 960
procesos terminaron con exit 0/signal null. Los JSON completos comprimidos
conservan exactamente los bytes originales y sus hashes. Se conservan los logs
iniciales y los once tests repetidos sobre los bytes finales de las fuentes.

La verificación de comparación se repite sobre los reportes descomprimidos con
assertWptParity real. macOS requiere nueva CI del SHA publicado. Los procesos
aislados acotan recursos entre fixtures; memoryAfterClose no usa GC, no observa
memoria pico y no demuestra ausencia de fugas internas. --max-old-space-size=2048
limita el espacio viejo de V8, no todo el heap ni RSS. No se migran APIs DOM ni
se acepta el presupuesto de ownership por esta corrección de infraestructura.
