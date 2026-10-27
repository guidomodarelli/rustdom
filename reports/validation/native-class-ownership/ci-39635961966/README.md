# Validación remota del head inicial

Run `39635961966`, head `8b5431534a6c7b2dbaac6a91bc0ad22a37a740f1`.
Linux, Windows, cuatro shards y el agregador de benchmarks aprobaron. macOS
quedó cancelado sin runner ni pasos ejecutados: la anotación de GitHub informa
que el job no fue adquirido y avisa falta de capacidad en runners arm64.
El run global terminó como failure; no acredita validación de macOS.

Los JSON preservan el estado, el job y sus anotaciones. No se cambió la matriz
ni se redujo la cobertura para evitar este fallo de infraestructura. La
publicación de los diagnósticos requiere checks del nuevo head, incluido macOS.

La review remota de `8b5431534a` terminó sin hallazgos; el recibo
`6321337456` y su URL están en `review-receipt.json`. Esa review no cubre commits
posteriores ni equivale a aceptar el presupuesto de rendimiento inconcluso.
