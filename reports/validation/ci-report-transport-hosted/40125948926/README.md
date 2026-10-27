# Transporte real del CI40125948926

Se autenticaron los artifacts de los shards0y2 del SHA6e1db099 cuando esos
jobs ya habían terminado. Cada ZIP conserva diez reportes nuevos/modificados,
incluidos reportes de fallos de los contratos; los hashes y tamaños de cada
miembro coinciden con artifact-manifest.json. MetadataAPI, ZIPs, manifiestos y
logs de ambos jobs permanecen íntegros. No se ejecutó su código ni se midió DOM.

| Shard | ZIP previo40121155551 | ZIP nuevo40125948926 | Archivos actuales | Bytes crudos actuales |
| --- | ---: | ---: | ---: | ---: |
|0|1995721591|178154|10|1180577|
|2|1995720595|176925|10|1180735|

Se observaron aproximadamente99.991%menos bytes transportados entre esos runs.
Es una comparación de payloads, no una estimación causal de duración del CI ni
rendimiento DOM. Esta observación no declara terminado ni verde todo el run.

En una consulta posterior, final-run.json y final-jobs.json confirmaron que
el run6e1db099 terminó success con sus ocho jobs. Se conserva por separado
la observación parcial anterior. Esto valida el arreglo del colector de
Windows y el CI general; no acepta el gate de rendimiento de ownership.

El checkout real es fe01733f2d939bcd31b2ee64c8dc00d47b7552a2, el merge sintético
que usa actions/checkout para pull_request. Se conserva esa identidad; el SHA
de la cabeza del PR es6e1db099. Los logs de checkout y el objeto Git de la API
vinculan el merge a esa cabeza, sin normalizar sourceCommit. La primera
comprobación del lector esperaba la cabeza en lugar del merge; se corrigió
la interpretación del transporte conservando el ZIP descargado, sin repetir
benchmarks. Los7572archivos históricos del scope permanecen en el commit Git.
