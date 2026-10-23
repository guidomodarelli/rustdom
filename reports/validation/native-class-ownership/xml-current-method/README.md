# Calificación previa de la evidencia XML completa

Los nueve contratos del wrapper pasan en Node22.12.0 y24.14.1 sobre Linux x64.
Se autenticó y extrajo el ZIP oficial39886057332, sin recompilar; las fuentes,
distribuciones y dependencias se copiaron físicamente desde esa preparación.
El verificador completo comprueba sus bytes antes de cada selección.

Los tests ejercen el CLI real y rechazan cambios en build.rs, implementación
canónica, JavaScript compilado, dependencia jsdom y flags Node no declarados.
También rechazan capturas que solapan el runtime y conservan accepted:null de
un experimento XML real cuya calibración impidió ejecutar A/B. No usan mocks,
no ejecutan benchmarks y no se cuentan como tests nuevos del producto DOM.

La revisión independiente Codex cubrió los seis archivos nombrados por sus
hashes en review.json. Cerró dos P2: pérdida de null y timeout exterior que
podía dejar un worker vivo. Resultado final: cero hallazgos accionables.
El wrapper espera al coordinador, sin timeout adicional; permanece el timeout
original por worker. actionlint pasó en ambos workflows. Este alcance no es
una review completa del PR ni aceptación de rendimiento.

Los logs crudos y qualification.json conservan comandos, versiones, salidas,
identidad de la preparación y archivos revisados. La preparación ya publicada
incluye los probes reales finitos de Window/Document en ambos Node; esta QA
nueva no agrega observaciones de memoria ni prueba ausencia universal de fugas.

El workflow prospectivo requiere este recibo antes de construir y medir.
Todavía no se ejecutó su secuencia al generar este paquete. Los gates de
ownership y XML siguen rechazados; ningún resultado histórico cambió.
