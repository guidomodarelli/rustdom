# Resultado conservado del gate XMLSerializer

La ejecución 39679501920/job119497967690 terminó con éxito para el SHA 61ed417d,
Node 24.14.1 Linux. Se conserva el ZIP original del artefacto 12384913614 y su
manifest de 937 entradas. El SHA-256 del ZIP coincide con el digest de GitHub.

verify.py recalcula las 14.976 duraciones medidas de 468 procesos: 208 A/A,
208 A/B y 52 de comparación jsdom/rustdom. Comprueba stdout original, engines,
orden de fases, las trece filas, resultados públicos completos, medianas por
fase/mitades y agregadas, conteos y decisiones. Dos tests ejercen el archivo
real y rechazan copias con agregados, observaciones o filas alteradas.

Las trece filas calibraron dentro de ±2% A/A y quedaron dentro del +5% A/B del
protocolo XML. Las diferencias A/B van de -1,338673% a +3,226057%; el máximo es
xml-serializer-getter-error/1. La calibración es A/A de Rust; las cuatro fases
jsdom/rustdom por fila son una comparación adicional, no un control jsdom A/A.

Alcance: referencia checkpoint 66 frente al candidato 61ed417d, con las fuentes,
binarios, versiones, entradas, warmups y hardware declarados en experiment.json
dentro del ZIP. El sourceHash del candidato es 6e0a5ffe…, anterior al harness
609e73b5…; no se atribuyen estos tiempos al código posterior.

El protocolo histórico no contiene el manifest completo de las distribuciones
JavaScript que exige el nuevo método de ownership. Se conserva su alcance real,
sin añadir retroactivamente esa identidad. Este resultado no acepta el presupuesto
separado de ownership, no cubre Node 22 y no demuestra ausencia de fugas.
No se ejecutaron nuevas cargas para producir esta conservación o verificación.
