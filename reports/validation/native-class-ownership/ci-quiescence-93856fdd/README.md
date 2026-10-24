# Fallo original de quiescencia en CI

El shard 2 de Validate rustdom, ejecución 39706343650, job 119587156042,
falló en el SHA 93856fdd27d2ab7036d8ea58cb1ec40f07f157e3. Se conserva el
log oficial completo comprimido, metadata del job y el JSON de su endpoint.
Los demás jobs de esa ejecución se deben consultar por separado.

La prueba all eight public workloads release warmup and measured Window/Document
objects in real runtimes falló en rustdom/observer-delivery-records/100. Su espera
estaba limitada a tres rondas y exigía dos observaciones consecutivas claras:

| Ronda | Window vivos | Document vivos | Nodos nativos vivos | clear |
| --- | ---: | ---: | ---: | --- |
| 1 | 2 | 2 | 14 | false |
| 2 | 2 | 2 | 14 | false |
| 3 | 0 | 0 | 0 | true |

La tercera observación alcanzó el endpoint, pero no quedó una segunda observación
para confirmarlo. Este dato no establece por qué se demoró la liberación ni prueba
ausencia universal de fugas. Tampoco justifica aceptar un recurso aún retenido.

La corrección separa el contrato funcional de liberación de la receta de medición:
usa la espera acotada existente del helper (12 rondas/10 segundos), manteniendo
dos observaciones consecutivas claras y todos los baselines nativos. No cambia
el helper, el runtime ni las tres rondas de los samplers de rendimiento.

La regresión usa Document reales retenidos por tres observaciones y liberados
después; no simula GC ni APIs internas. Resultados Node 22/24 y límites en
[runner-sharing](../runner-sharing/README.md).

xml-run.json y xml-jobs.json documentan además el éxito de 39706343771:
el workflow XML verificó la evidencia histórica y omitió build/medición.
No aceptó el presupuesto separado de ownership. El SHA 93856fdd sigue sin
revisión remota nueva: el servicio devolvió falta de cuota, comentario 6330524298.
