# Recursos de la integración portable de telemetría

El subconjunto contiene únicamente los bytes originales de ocho procesos de
MutationRecord y el índice completo original. La extracción autentica el ZIP
antes de crear el destino y copia/hash en bloques de 1 MiB, con context managers
para cada descriptor. Los contratos usan temporales propios y comprueban la
preservación de un destino existente, un enlace y un archivo corrupto.

La calificación ejecuta lectores reales y derivaciones en hijos que terminan
con timeout; conserva stdout/stderr/argv y el prefijo ante un fallo. La fixture
Git propia se restaura en finally y se exige que el checkout termine limpio.
No se cargan paquetes DOM, ni se crean Window/Document o perfiles nuevos.
Los perfiles/logs históricos se analizan por proceso con el lector compartido;
la copia del ZIP y la extracción no acumulan todos los JIT logs en memoria.

La evidencia de estos contratos no mide memoria pico ni demuestra ausencia
universal de fugas. Tampoco prueba el teardown de la futura captura de Range.
La captura sigue deshabilitada; sus observaciones finitas de Window/Document,
baselines y rondas finales siguen pendientes. performanceAccepted=null y
gateReevaluated=false; el rechazo histórico de ownership permanece.
