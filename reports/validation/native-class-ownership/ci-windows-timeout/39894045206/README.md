# Timeout del harness de referencia en Windows

El job120220203396 del run39894045206 falló en la prueba de procesos WPT del
commit70fc69ee. Node24.21.0 ejecutó jsdom27.4.0 y rustdom en procesos separados.
Ambos produjeron los mismos2808 resultados individuales correctos de
Range-mutations-dataChange.html; la referencia devolvió estado global2 del
harness y el candidato0. La comparación rechazó correctamente esa diferencia.

La referencia tardó137427.7593ms y superó el límite largo efectivo120000ms
(60000ms ×multiplicador2). El proceso terminó normalmente antes de180000ms.
La corrección configura el multiplicador soportado por el runner upstream en3
para ambos motores: límite largo180000ms, failsafe del fixture210000ms y del
proceso240000ms. Conserva el corpus upstream, asserts, comparación y deadlines
finitos. No cambia los presupuestos de benchmarks ni aprueba este fallo pasado.
No se atribuye el tiempo observado a una versión de Node o causa de rendimiento.

comparison.json.gz contiene los bytes JSON originales comprimidos sin pérdida.
Se obtuvo solo esa entrada del ZIP oficial mediante rangos HTTP; zipfile comprobó
su CRC. No se descargó ni autenticó el ZIP completo de1093554367bytes. El recibo
distingue esa lectura parcial del SHA del artefacto declarado por GitHub.
La regresión exige que el informe original siga fallando, aunque cada assertion
individual pase. Las pruebas reales de ambos motores también siguen exigiendo
estado global0 y comprobando que un harness abierto termine por timeout.

La validación nueva pasó nueve contratos de procesos reales por Node22.12.0
y24.14.1 sobre Linux, con el addon publicado en la preparación39886057332.
Incluye los fixtures completos de5 y2808 casos por motor, el timeout real de
un harness abierto y la terminación observable de sus procesos. No usa mocks.
Los logs y hashes de fuentes quedan en qualification.json y node*.log.

Windows local con jsdom27.4.0 y Node24.21.0 también terminó el fixture largo
con estado0 y los2808asserts correctos; windows-reference.json.gz conserva
el resultado completo. Esto no acredita todavía rustdom en Windows ni el
CI remoto posterior. La revisión independiente del delta terminó sin hallazgos.
Los datos de memoria son endpoints de procesos finitos y no una medición de
memoria pico ni una certificación universal de ausencia de fugas.
