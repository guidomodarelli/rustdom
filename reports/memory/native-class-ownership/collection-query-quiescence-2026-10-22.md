# Colecciones: espera acotada y retención deliberada

Se corrigió una terminación prematura de la prueba funcional de memoria,
observada en Windows Node 24.22.0 con jsdom/VM. El primer estado sin supervivientes
llegó en la última ronda permitida, a 326,77 ms, sin margen para confirmar otro.
La espera de colecciones permite ahora hasta 64 rondas bajo el mismo deadline
de diez segundos y exige dos estados claros consecutivos con contadores nativos
exactos. El helper canónico y el protocolo de rendimiento siguen intactos.

| Entorno | Evidencia | Resultado |
| --- | --- | --- |
| Linux Node 22.12.0 | Cinco tests reales, ambos motores y realms; 52 escenarios originales | 60 endpoints exitosos, 120 observaciones finales claras |
| Linux Node 24.14.1 | Mismo alcance | 60 endpoints exitosos, 120 observaciones finales claras |
| Windows Node 24.22.0 | Regresión jsdom, default/VM | Libera después de 14 rondas; rechaza retención durante 64; libera al quitar propietario |

La regresión mantiene una colección real durante doce observaciones y exige
liberación posterior de Window y Document por separado. Un propietario persistente
no pasa ni con la política nueva. La prueba completa sigue cubriendo colecciones
vivas, nodos retirados, mutaciones, transportes retenidos y baselines nativos.

Los datos crudos, trazas por ronda, heap/external/RSS posteriores a GC, versiones,
comandos, fuentes y el fallo original autenticado están en
[la evidencia de validación](../../validation/native-class-ownership/collection-query-quiescence/README.md).
Son pruebas finitas; no miden picos ni demuestran ausencia absoluta de fugas.
Windows nativo completo debe confirmarse en CI. No suma APIs Rust ni acepta
el presupuesto de rendimiento pendiente del hito de ownership.
