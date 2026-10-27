# Recursos del método prospectivo

El colector del estudio nuevo conserva entre procesos solo una vista de los
escalares necesarios para el estimador: revisión, Node, RNG, carga, etiqueta,
nueve duraciones y hash público. Los arrays se copian. Los reportes completos,
con listas de módulos y trazas de recursos, se validan y quedan íntegros en disco.
El código anterior de este método aún sin ejecutar retenía todos esos objetos
hasta la decisión; se corrigió antes de publicar o consumir el estudio.

Se ejerció la proyección con los 80 reportes funcionales reales de 8ea5f569,
sin nuevas ejecuciones DOM ni muestreo. Sus JSON compactos suman 45339618 bytes;
las vistas serializadas, 39791 bytes. Las 720 duraciones medidas, hashes y
prefijos RNG se preservan. Los lectores Node22 y Node24 producen bytes idénticos.
Estas cifras son tamaños JSON; no representan heap, RSS, memoria pico ni una
medición de mejora de memoria, ni deben extrapolarse a todo rustdom.

El protocolo fija un máximo de 2048 reportes/procesos. Las vistas no conservan
referencias a los objetos completos. El estudio registraría snapshots reales
del proceso padre antes de los workers y después de cada Node, sin usarlos
para decidir rendimiento. Todavía no hay resultados de ese estudio.

Los escenarios reales de liberación siguen siendo los ya publicados:
960 Window y 960 Document observados por separado, nueve primeras rondas no
claras y 160 estados finales claros, con baselines nativos preservados, en
shared-fixture-worker. No se repitieron. No son memoria pico ni garantía
universal de ausencia de fugas. No cambió el runtime Rust/N-API ni su teardown.
