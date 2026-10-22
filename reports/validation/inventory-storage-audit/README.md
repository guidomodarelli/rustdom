# Inputs de la propuesta de Web Storage

Los catorce archivos de `sources/` se preservan byte a byte. `receipt.json`
identifica la referencia jsdom27.4.0, el catálogo, el artefacto oficial y los
hashes cotejados. Se verificaron tres originales, cuatro archivos construidos
y cuatro inputs locales frente a sus manifests. Los tres archivos de tests se
inspeccionaron desde la base del repositorio; no se ejecutaron.

El mapa físico ya publicado corrobora los hashes de Window, Storage-impl y
Storage generado. Solo este último conserva el original con la adaptación
privada de require; los otros dos fueron reescritos. El bridge coincide tras
la sustitución declarada del import de native. Es una comprobación de identidad,
no un test de strings internos como sustituto de comportamiento observable.

La clasificación propuesta y sus límites están en
`reports/progress/inventory/storage-audit.md` y `storage-audit-proposal.json`.
No modifica el ledger de Storage, no acredita nuevo Rust y no ejecuta otro
benchmark mientras corre la secuencia de ownership. El WIP de geometría se
mantiene separado. Los resultados funcionales/memoria citados son históricos;
la incorporación futura al catálogo exige validación y revisión propias.
