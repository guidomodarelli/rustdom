# Memoria del CI 40344594060

Se conservan los reportes de memoria de los tres jobs de validación originales,
sus archivos y procedencia en `provenance.json`. La fuente de PR es
`7148577dcf1eeffda2ebf95a3ccd1eb173a6082b`; el checkout observado corresponde
al merge `88b893a888b5cebd37b532b7a0eeb0c142fab1b6`.

En Linux, Valgrind **3.18.1** completó **311 tests Rust en diez batches** de
hasta 32 tests, con un thread de tests y límite de 600 000 ms por batch.
Los diez terminaron correctamente. El comando exige completar cada test y
rechaza accesos inválidos y fugas definitivas o indirectas. Los logs íntegros
mantienen también posibles fugas y asignaciones alcanzables para inspección.

Este Memcheck cubre el ejecutable real de tests Rust, incluidos los guards de
ownership; no cubre V8 ni el addon cargado en Node. Los demás reportes conservan
sus propios escenarios, runtimes y límites. No deben combinarse como una
prueba de ausencia universal de fugas ni como una medida de memoria pico.

Los artifacts completos autenticados y los logs de jobs están en
`reports/validation/jsdom-block-pilot/readiness/20261026/prior-general-ci-714/`.
No se ejecutó código archivado ni se repitió una medición para recolectarlos.
El gate de rendimiento de ownership no se reevalúa con estos resultados.
