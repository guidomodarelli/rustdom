# Gate XML del candidato eaeca4af

La ejecución 39697882498/job119559618634 terminó success para eaeca4af, Node24.14.1 Linux.
El ZIP original del artefacto 12393700893 coincide con el digest oficial
`ee3f7cf2d3d9812a9a2ac23f75d33c66f01574ca6694abe3273f23f5638e0866` y conserva 937 entradas y sus CRC.

El verificador histórico sin cambios recalculó 14.976 duraciones de 468 procesos:
208 A/A, 208 A/B y 52 de comparación jsdom/rustdom. Conserva las trece filas,
órdenes, resultados públicos, medianas por fase/mitades y agregadas y decisiones.
Las trece calibraron dentro de ±2% A/A y quedaron dentro de +5% A/B.
Las diferencias A/B van de -1.393455% a +3.330046%; máximo xml-serializer-getter-error/1.

La calibración es Rust A/A. La comparación jsdom/rustdom es adicional y no es un
control jsdom A/A. Los tests históricos sin cambios ejercen este archivo real y
rechazan agregados, observaciones o filas alterados.

Fuente candidata: 0d67e1d821c70371ca1b82817870b7ad6a053f534161ae9096591d7199d0b947.
Binario candidato en CI: 221e6754e8e6ef461007f5d6834cb586ebbf0f0a6d8556651ab93b64e6b9c0f5.
La fuente coincide con C, pero este binario CI es distinto del addon local afbf5e85.
Se conservan sus versiones, herramientas, settings y metadatos originales dentro del ZIP.
El protocolo histórico no fija el manifest completo de JavaScript de ownership.
No se añade esa identidad retroactivamente ni se equiparan los dos binarios.

Este resultado acepta solamente el gate XML declarado en Node24 y checkpoint66 como
referencia. No acepta ownership, no cubre Node22 ni demuestra ausencia de fugas.
Los resultados XML anteriores, favorables y fallidos, permanecen intactos.
No se ejecutaron nuevas mediciones para conservar o verificar este artefacto.
