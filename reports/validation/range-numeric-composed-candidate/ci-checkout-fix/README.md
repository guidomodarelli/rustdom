# Corrección del checkout parcial de GitHub Actions

El run 40260877389, intento 1, SHA 8dc0513a, falló en preparación antes de
compilar. Los ZIP Linux24 y Windows22 están autenticados por ID, run, commit,
tamaño y digest y se conservan íntegros con API/manifest y stderr original.
No hubo una captura de rendimiento ni se aceptó el candidato en CI.

La causa es reproducible: actions/checkout usa un repositorio parcial/promisor.
El contrato intentaba `git clone --shared` sobre él; upload-pack no puede
resolver blobs no hidratados cuando tiene deshabilitada la descarga diferida.
El mensaje «possible repository corruption» no demuestra corrupción del
checkout parcial. La validación local anterior usaba un objeto completo y no
cubría esta diferencia.

El fix crea metadatos Git independientes en un directorio nuevo, comparte
los objetos locales como un clone con alternates, conserva shallow y la
declaración promisor y deja que **Git haga checkout del commit auténtico**.
No se escriben un HEAD ficticio ni campos sourceCommit/sourceChangesRaw.
Los 344 inputs se autentican después; la fuente queda sin cambios.

La regresión usa filtrado real `blob:none` mediante protocolo file, profundidad
uno, patrones sparse y el origen desconectado. Pasó
en Linux y Windows. Verifica contenido requerido disponible, blob excluido
todavía ausente, `.git` real, SHA correcto, estado/configuración originales
intactos y `git fsck --connectivity-only` exitoso. Los cinco contratos reales
de preparación de 344 inputs también pasaron, junto con actionlint.

Las pruebas y fixtures Git completos quedan guardados. Son datos de auditoría;
no ejecutar hooks, scripts ni código archivado. Para reproducir usar las
herramientas actuales versionadas. No se cambió Rust, el binding, tipos ni
el patch compuesto; conserva la calificación local de runtime ya publicada.
La nueva matriz hosted aún debe comprobarse sobre el commit del fix.

Los manifiestos de publicaciones anteriores describen sus commits exactos.
No se reescriben para aparentar que los nuevos bytes de herramientas ya habían
sido revisados. El rechazo histórico de rendimiento permanece intacto.
