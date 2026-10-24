# Validación del método hosted antes de medir

Los nueve contratos de `hosted-main.spec.cjs` pasaron sin exclusiones en Node
22.12.0 y 24.14.1 contra el artefacto oficial extraído del run 39720077911.
`processes.json` y `node*.stdout.log` conservan comandos y resultados completos.
No se recogieron muestras de rendimiento ni se cambió la decisión histórica.

Las pruebas verifican todos los paquetes reales del calendario y operaciones
Range con asignaciones nativas independientes. Rechazan otra preparación,
dependencias alteradas, evidencia existente, aliases dentro del archivo y el
intento de presentar el estudio WSL anterior como hosted. El driver real deja
un informe incompleto sin workers si la huella del arnés no corresponde a la
revisión. No hay mocks de librerías internas ni pruebas de imports textuales.

El algoritmo de muestreo y su verificador originales permanecen sin cambios;
solo se enlazan los nuevos paquetes oficiales y las comprobaciones de preparación
antes/después. El workflow pasó actionlint. La huella final del arnés y el recibo
de revisión se registran en `review.json` antes de publicar y activar el método.

La revisión estática terminó con cero hallazgos: 373 archivos del arnés,
SHA-256 `7ef509af5d2e5cf32bcb9ab059fd77e128d34c638028c482b315cdab480f4123`.
También pasó el paso real de preflight del YAML: autenticación ZIP/tar,
extracción, comprobación del recibo y verificación de la preparación completa.
`preflight-process.json` conserva ese resultado sin ejecutar el paso de medición.
Su SHA de commit es deliberadamente un marcador local inválido, guardado como
fixture; no es procedencia aprobada para un estudio ni se usará para medir.

El [protocolo](../../../benchmarks/native-class-ownership/HOSTED-MAIN-PROTOCOL.md)
declara una única secuencia completa, sus presupuestos y sus límites. La etiqueta
de activación no se retira y reaplica. Una ejecución omitida o un build verde no
equivalen a aceptación: se exige evidencia completa y `accepted=true` en ambos Node.
