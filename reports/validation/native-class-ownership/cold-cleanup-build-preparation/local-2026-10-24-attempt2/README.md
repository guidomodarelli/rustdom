# Preparación local del candidato con limpieza fría

Se construyeron y verificaron A0/A1/B/J0/J1 con la receta original, Node24.14.1,
npm11.11.0, Rust/Cargo1.99.1 y Ubuntu22.04/glibc2.35. No se ejecutó un sampler.
Este paquete es evidencia de build local, no una autenticación de un artifact de CI.

A es checkpoint067: commit3d37f899, objeto tagc869f3c0, fuente67523bf3; B parte del checkout8dba217b y aplica
exclusivamente el patchd869ec4a a su guard. El resultado tiene fuente5273aae0.
Esa diferencia de dos atributos se refiere al candidato anterior5ef668c4, no a
todas las diferencias del PR frente al checkpoint067. Ambos checkouts Git y sus
diagnósticos reales se preservan en metadata/build-index.json y patch.json.

El nuevo binario B tiene SHA256 `9bab7909799346eedf30f380b78eb9dcbda085e38bc6eb82df9fda12eb0d1f7e`.
El build fresco reprodujo exactamente los bytes del addon del prototipo anterior. Sus fuentes
son las ya calificadas; esta preparación prueba sus propios paquetes con probes
y contratos, sin afirmar que se repitieron aquí las suites completas Jest/Vitest.

## Validación y memoria

Pasaron ocho contratos en Node22.12.0 y24.14.1. Ejercen CLI, paquetes reales,
relocalización con carga del runtime, adulteración del productor con un nuevo hash declarado, inputs,
identidades viejas, falsos endpoints claros y overrides rechazados antes del build.
Los probes canónicos crearon15 Window y15 Document por versión, en tres ciclos
de cinco paquetes. Preservan todas las rondas y dos estados finales claros por
paquete, con aislamiento de contadores nativos. Los contratos de relocalización
ejecutan ciclos adicionales que no se suman a esos conteos canónicos.

El informe reports/memory/cold-cleanup-build-local-2026-10-24-attempt2.json conserva los
endpoints y baselines completos. Son observaciones finitas, no memoria pico ni
ausencia universal de fugas. WPT/Jest/Vitest completos del mismo código fuente
siguen documentados en cold-cleanup-compatibility; esta evidencia no amplía su
alcance a otras plataformas ni demuestra rendimiento.

## Archivo y alcances

preparation.tar.xz conserva7896miembros:7050archivos regulares,6enlaces y directorios.
SHA256 `da5bb921ab200acf94d1d168d3d2859f5512c3d23bb02d370195f7387e7790d7`, 7897588bytes.
Se autenticaron todos los miembros sin extraer ni ejecutar scripts archivados.
members.json describe el archivo completo; metadata/ y validation/ permiten leer
índice, identidades, reportes y logs sin cargar los runtimes.

El harness heredado de build tiene360archivos, distinto del gráfico434 del estudio
anterior. Los 26/46pins y esas434fuentes principales permanecen intactos. Las
fuentes nuevas del productor también se comprueban contra el código revisado.
Los ocho archivos nuevos suman461líneas; el productor existente
no se editó. Las políticas estáticas viven en constants/; verification.json
registra la búsqueda reproducible y sus límites. Actionlint aprobó el workflow.

## Continuidad

No se cambió el runtime principal, no se aceptó rendimiento y no hay tag ni merge.
El workflow nuevo solo construye paquetes y prueba comportamiento/recursos.
Antes de cualquier secuencia nueva faltan CI de la preparación, autenticación de
su artifact y un método prospectivo completo, probado, revisado y publicado.
Las autorizaciones anteriores siguen consumidas; no reutilizar sus etiquetas.
El runtime sigue híbrido y el objetivo completo de migración permanece pendiente.
