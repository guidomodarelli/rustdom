# ZIP originales y almacenamiento acotado

Los ZIP se guardan como partes Git de hasta 32 MiB, no como árboles expandidos.
originals.json registra tamaño y SHA256 de cada ZIP, lista ordenada de partes,
sus SHA256/OIDs y commits confirmados. Las partes se conservaron antes de
decodificar el ZIP y se releyeron remotamente y desde el Git local.

Para reconstruir un original, concatenar sus blobs binariamente en el orden
de publication.parts, crear una salida nueva y verificar tamaño/SHA256 contra
original. No ejecutar código del ZIP o del tar; usar los lectores mantenidos.
Los archivos completos siguen disponibles en Git aunque las partes tengan
skip-worktree y no ocupen copias adicionales en el checkout Windows.

Esta sincronización solo admitió cuatro commits/4 adiciones, 80.567.677 bytes
lógicos. La guardia inicial rechazó el fetch por capacidad: 201.187.328 bytes
libres frente a 228.244.218 requeridos. No se redujo la reserva. Se desmaterializaron
cinco copias históricas limpias, 307.530.492 bytes, mediante sparse checkout local,
tras verificar SHA256 contra sus blobs Git y metadata remota del mismo commit.
No se borró ningún objeto Git ni original remoto. Los 903 hashes y el paquete
sellado se revalidaron; los targets cuya limpieza había sido rechazada siguen
intactos. Las reglas previas de sparse también se conservaron.

El fetch posterior fue normal, sin filtros/promisor ni GC automático; las cuatro
partes quedaron sparse y sus bytes se verificaron por streaming. Git almacenó
los blobs como objetos sueltos: cero packs nuevos no significa cero datos nuevos.
storage-sync.json registra los bytes lógicos y físicos observados y el temporal
antiguo preservado. El guard HTTPS inicial se corrigió para admitir también el
SSH canónico configurado de este mismo repositorio, sin modificar la configuración.
sync-receipts.tar.gz conserva los nueve archivos de auditoría, logs y herramientas
de esa sincronización; sync-inventory.json registra su segunda lectura íntegra.

Esto **no califica descargar el piloto completo al Git compartido**. Volver a
comprobar capacidad y usar publicación/lectura nativa por partes para el resto.
No aplicar filtered fetch al repo compartido ni borrar sus packs u objetos.
Para restaurar las cinco copias históricas, usar sus OIDs del recibo de sparse
con una salida nueva o quitar solo sus exclusiones específicas tras comprobar
capacidad; los archivos permanecen en el commit 4196c496 y en el remoto.
