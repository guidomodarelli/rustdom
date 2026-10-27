# Coordinador secuencial calificado

La prueba integrada d959 conservó 34 artifacts existentes, 519.407.877 bytes
originales y 37 partes con lectura remota independiente. Completó 64 replays
parciales del v1 consumido y cuatro replays completos AA/AB del CI 40395417183,
en Node 22.12.0 y 24.14.1. Los cuatro replays completos leen solo 64 procesos
únicos, 9.216 duraciones y 3.072 warmup ya capturados; no crean muestras nuevas.

Los 1.597 recibos de procesos cierran sus árboles. Se retiraron 74 repositorios
Git descartables y las copias exclusivas del receptor después de confirmar
la publicación íntegra y ambos lectores. Los originales prestados permanecen
intactos. El rechazo deliberado del inspector conserva ZIP y slot derivados.
Las 38 publicaciones de datos terminan en b9c0fab317c7ff14c567492802afd536cf40a6bc.

Se conservaron siete controles del loader, 31 casos de metadata/ZIP y seis
límites de filesystem. El descriptor de integración d959 y sus fuentes
as-run están dentro de transport-receipts.tar.gz; no ejecutar código archivado.
transport-inventory.json enumera los 5.531 miembros, tamaños y hashes, con
segunda lectura íntegra. qualification.json distingue los dos descriptores.

La revisión detectó un P2 adicional en la entrada de producción: el scan de
credenciales ocurría después de publicar. El overlay 89dd lo corrige con un
callback previo al primer push, sin modificar el algoritmo de publicación.
Una prueba con un ZIP auténtico de 54.375 bytes y credencial sintética rechazó
la publicación, conservó el original y verificó que la rama no cambió. Cuatro
casos adicionales rechazan optimización Python, salida existente, namespace
con credencial sintética y un run histórico real de fuente/workflow diferente.
Los seis límites de filesystem también pasaron con el descriptor nuevo.

La entrada mantenida tools/evidence-transport/collect.py admite solo un run V2
terminal explícito, fuente 4196c496 e intento 1. Verifica el lock, la fuente
Linux real y limpia, los 903 bindings y ambos SDK antes de leer. Publica cada
ZIP opaco antes de interpretarlo; ante incertidumbre conserva parciales e
intentos. No activa workflows ni ejecuta DOM o scripts de la captura. Necesita
un directorio nuevo directamente bajo /run y el SHA padre remoto explícito.

Los errores del exportador se conservan en preservation-error.json: los
recibos de streaming y de comandos tienen esquemas distintos y los 64 exits 1
de lectores parciales son esperados. La continuación corrigió únicamente el
resumen; no reemplazó el archivo preservado ni repitió una captura.

La sincronización compartida importó 38 commits y 327 trees en 55.232 bytes,
sin blobs nuevos: sus 37 blobs ya existían localmente. Esta propiedad no debe
suponerse para una captura futura. No usar filtered fetch en el repo compartido.
No se borraron objetos Git ni se reintentaron las limpiezas rechazadas.

Esta calificación habilita el transporte; no es una captura científica ni
acepta rendimiento Rust. performanceAccepted=null y gateReevaluated=false.
Los dos checks ownership conservan el rechazo histórico. No hay tag ni merge.
El runtime sigue híbrido y la migración general continúa pendiente. Los
recursos y límites están en reports/memory/git-evidence-transport/20261026/coordinator.json;
no se midió memoria pico ni se demostró ausencia universal de fugas.
