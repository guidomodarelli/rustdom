# Fuentes históricas para el contrato de reutilización

Estos snapshots contienen los bytes reales de las fuentes A/B registradas en
`hosted/39643090437/index.json`: 331 archivos de A y 333 de B. Su propósito es
mantener el positivo de `canReuse` independiente del candidato actual, del
protocolo actual, de `.baseline` y de la disponibilidad de objetos Git antiguos
en un checkout `depth: 1`. No se ejecuta ni se vuelve a medir el experimento.

`manifest.json` registra el SHA-256 de cada archivo comprimido, el digest de
fuentes, el commit medido que consta en el index histórico y la correspondencia
de los tres archivos de protocolo. Los snapshots se obtuvieron de árboles
locales cuyos digests completos coinciden exactamente con `sources.A` y
`sources.B` de ese index; su procedencia se establece por los bytes y no por el
HEAD del árbol local. Los commits consignados son metadata del experimento y
no son requisitos para ejecutar los contratos.

Cada `.json.gz` contiene un array de `{ "path", "bytes" }` en el orden de
`measuredSources`; `bytes` es Base64 de los bytes originales, sin normalizar
saltos de línea. Se generó con JSON compacto ASCII y gzip de nivel 9 con
`mtime=0`. Para reproducirlo desde los mismos árboles: recorrer la lista
histórica, leer cada archivo como bytes y verificar primero su digest completo
con el algoritmo real de `benchmarks/sources.cjs`; después comprimir el array y
registrar el hash del snapshot. No sustituir estas fuentes por las del checkout
actual ni actualizar los hashes para hacer pasar el positivo.

El test verifica los hashes de los snapshots, los materializa en directorios
temporales propios y copia el driver, las constantes y `HOSTED-PROTOCOL.md`
del archivo histórico. Invoca el `canReuse` real, que a su vez carga el
`captureSourceIdentity` real del candidato histórico. Las regresiones cambian
bytes de una copia de la implementación, de la referencia o de cada archivo
de protocolo y exigen `false`. Cada árbol temporal se elimina al finalizar el
test, incluso si falla una aserción. No se modifican el checkout ni la evidencia.

El archivo histórico conserva `accepted=false`: seleccionar evidencia idéntica
no acepta su presupuesto y el gate existente debe seguir rechazándola.
