# Review de extremos desconectados

El comentario `3995732460` del PR 15 propuso validar siempre la raíz de ambos
extremos antes de reunir texto. Se contrastó con el algoritmo real de jsdom
27.4.0 y con el addon reconstruido desde `643f59e75c5b37b7245d9f5713d3d315c21412d4`.
Los cambios de seguimiento agregan pruebas y aclaraciones; no cambian `src`,
scripts de build ni benchmarks.

| Estado interno de extremos | jsdom | rustdom / NativeTree |
| --- | --- | --- |
| Text independientes `first` desde 1 y `second` hasta 2 | `irstse` | `irstse` |
| Fragment vacío y Text independiente hasta 2 | `se` | `se` |
| Fragment con Text contenido y extremo final independiente | Error de raíces | Mismo error / null |

Los setters públicos colapsan extremos de raíces distintas. La reproducción
usa nodos y rangos reales, configura sus extremos internos mediante los
helpers originales y llama al stringifier público, sin mocks. La API de bajo
nivel comprueba los mismos resultados directamente. Así se verifica el contrato
privado que se está migrando, sin presentar estados internos inconsistentes
como un flujo normal de los setters públicos.

La comprobación anticipada propuesta cambiaría los dos primeros resultados.
`rangeText` devuelve null solo cuando una comparación de contención encuentra
raíces diferentes; no existe una validación incondicional previa en el
stringifier fijado. Se aclara ese alcance en la declaración pública y se agrega
una regresión permanente para las tres rutas. El hallazgo se rechaza como
cambio de comportamiento; la aclaración del contrato sí se incorpora.

Los logs Node 22/24, la reproducción estructurada, la identidad del build y
el commit de base están junto a este informe. Las pruebas nativas comprueban
también que todos los handles creados se liberan. Los análisis de memoria y
benchmarks del PR original siguen describiendo el mismo código de producción.
