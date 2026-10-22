# Recursos durante contratos de instrumentación

Se ejecutaron J0 y A0 por separado en Node 22.12.0 y 24.14.1, sin profiler CPU:
cuatro procesos funcionales con ocho cargas cada uno. Los reportes completos
están en el tar de `reports/validation/native-class-ownership/sampler-diagnostics-method/`.

Se observaron 384 referencias Window y 384 Document, incluidos warmups.
Hubo 96 observaciones de cleanup y las 64 finales exigidas quedaron claras,
con baselines nativos. Cuatro observaciones iniciales aún no claras se conservaron;
no representan cuatro objetos únicos ni demuestran fugas. No se alteraron las tres
rondas ni el requisito de sus dos últimas claras.

El observer GC conserva cuatro números por evento, sin objetos DOM. Se
registraron eventos durante estos procesos; el total final está en `summary.json`.
El array crece durante cada
proceso acotado y desaparece al salir. El wrapper desconecta el observer en
`finally`, también ante error. Tres contratos por Node verifican errores
retenidos, protección de telemetry existente y conservación del GC pendiente
mediante un segundo observer real; esas invocaciones inválidas no
crean fixtures DOM ni se suman a las referencias anteriores.

La preparación verifica bytes y genera una copia; no modifica el arnés ni los
paquetes originales. Sus contratos negativos preservan destinos existentes.
La identidad completa de la preparación oficial se verifica antes y después de
los contratos en ambos Node; se conservan los cuatro resultados.

Se conservan heap, external y RSS tras cleanup en los crudos. No son memoria
pico, no se atribuye RSS a una fuga del addon y no se demuestra ausencia
universal de retención. La captura futura con CPU profiler tendrá un alcance
distinto, recursos propios del profiler y overhead; debe informarse por separado.
