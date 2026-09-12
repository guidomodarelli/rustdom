# Endpoint verificable de memoria

Se corrigió una brecha confirmada del arnés: `exerciseAttributeChurn` construía un fixture adicional sin observar su Document ni su Window y conservaba referencias fuertes locales hasta que se liberara su scope async. El endpoint final se elegía después de dos GC mayores y drenajes fijos, sin comprobar que también hubiera terminado la limpieza de `FinalizationRegistry`.

El informe original del job macOS `103488170289`, run `34669548317`, se conserva sin modificaciones en `reports/memory/2026-09-12T03-09-31.501Z-darwin-arm64-ci-original.json`, SHA-256 `38551880f317f4850b2f0ba19f588d416110ffb1695d6b7b12f18f6355636466`. Observó cero supervivientes entre 880 Document/Window registrados, pero quedaron cinco registros nativos, cinco entradas de datos y tres colecciones. Otro job del mismo SHA pasó. Ese resultado no permite decidir por sí solo si el fixture omitido seguía vivo o si faltaban finalizadores.

Una copia diagnóstica del worker original, con el addon sin modificar y Node24.20.0, identificó en Linux los seis IDs del fixture omitido: `44001` Document, `44002` doctype, `44003` html, `44004` head, `44005` body y `44006` div. Se observaron antes del último drenaje y luego se liberaron todos. La ejecución no reprodujo el fallo exacto de macOS tras los dos ciclos originales; la instrumentación agrega WeakRefs y puede influir en el scheduling. La traza completa está en `reports/memory/2026-09-12-memory-endpoint-baseline-node24.20-linux.json`.

El cambio observa ahora los 881 Document/Window, suelta las raíces propias del fixture en `finally` y exige dos muestras claras en turnos separados. Cada muestra exige cero WeakRefs de los grupos entregados y los contadores nativos exactamente en su baseline, incluyendo la relación entre registros indexados y nodos vivos. La espera tiene límite de 12 rondas y un deadline de 10 segundos comprobado entre rondas. Conserva todas las trazas numéricas y toma `terminalMemory`, supervivientes y estado nativo de una misma muestra síncrona. También establece un endpoint antes del fixture vivo para no incorporar residuos previos a su baseline.

No se cambiaron los umbrales de crecimiento, las exigencias de cero ni el código de producción. `scripts/memory-endpoint.cjs` es infraestructura de medición; acepta grupos arbitrarios de WeakRefs. `collectGarbage` conserva el drenaje anterior para las muestras de los batches y los nuevos endpoints agregan verificación de estado.

Validación ejecutada:

- Build del código exacto `0d13903b083edf0ae4df650919927b3e43a1dfb3` en un clon nuevo, con dependencias congeladas y target Rust propio.
- Node24.20.0 Linux instalado localmente y verificado contra `SHASUMS256.txt` oficial, para igualar la versión Node del job macOS.
- Dos tests de integración por versión, Node24.20.0 y Node22.12.0: seis ciclos reales por motor. Retener un Document cerrado produjo exactamente cinco nodos nativos en rustdom y fue rechazado; al soltarlo se aceptó únicamente el estado cero. No se mockeó GC, el DOM ni los contadores.
- `node scripts/memory-check.cjs` con Node24.20.0: los cinco modos pasaron. jsdom y rustdom observaron 881 Document y 881 Window, todos recolectados; los entornos Vitest observaron 440 de cada uno, también recolectados. Cada endpoint alcanzó dos muestras claras en un máximo observado de 41 ms.

El informe completo nuevo es `reports/memory/2026-09-12T03-38-22.077Z-linux-x64.json`. En rustdom el crecimiento de heap fue aproximadamente 0,71 MiB y de RSS 2,78 MiB, con contadores nativos en cero. Los controles negativos prueban que la nueva espera no acepta el estado de cinco nodos retenidos; no prueban cuál fue la causa exacta de scheduling del job macOS. La CI del nuevo SHA debe validar ese entorno.

Se reutilizan los tests y benchmarks de producción del commit base, porque no cambian Rust, DOM, runners, dependencias ni build. Las pruebas finitas y las observaciones de RSS no demuestran ausencia absoluta de fugas. Los logs se normalizan a LF para Git; los JSON del diagnóstico y del job original conservan sus datos completos.
