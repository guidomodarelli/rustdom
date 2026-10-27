# Diagnóstico A/A contrabalanceado completo

La única secuencia fijada terminó entre 2026-10-21T18:49:01.443Z y 2026-10-21T18:55:21.482Z, con exit 1.

Node v22.12.0, V8 12.4.254.21-node.21; linux/x64, 13th Gen Intel(R) Core(TM) i7-1360P, CPU 2. Son 16 procesos, 576 duraciones y 768,000 copias públicas incluyendo warmups. Se verificaron todas las observaciones y las diez fuentes congeladas antes de medir.

| Filas | Rust A/A Δ% | Control jsdom A/A Δ% | Calibración |
| --- | ---: | ---: | --- |
| 250 | -2.1335 | -31.7389 | No |
| 1000 | -0.3293 | -7.5229 | No |

Calibración global: false. accepted=false porque no se ejecutó A/B ni se midió el candidato B. El contrabalanceo no alcanzó para calibrar esta carga con los umbrales fijados; no se repite la misma secuencia para buscar aprobación. Los estudios originales y sus gates permanecen intactos; merge y tag siguen pendientes.

Los últimos dos endpoints de Window/Document quedan claros en las 768 observaciones. Cada worker Rust comprueba contadores independientes y liberación. Las muestras de memoria posteriores a limpieza no son memoria pico ni una garantía universal de ausencia de fugas. El resumen está en reports/memory/native-class-ownership/balanced-aa-2026-10-21.json.

Las nueve fuentes ejecutables/documentales del método están copiadas en este archivo. before-performance.json, contratos Node22/24 y la revisión que cerró el P2 de reserva exclusiva están en reports/validation/native-class-ownership/balanced-method/. El método conserva el sample y cleanup originales sin modificaciones. Se archivan stdout/stderr y resultado terminal, incluidos resultados desfavorables.

Recalcular fidelidad:

`node reports/benchmarks/native-class-ownership/balanced-experiment.cjs --verify reports/benchmarks/native-class-ownership/balanced/2026-10-21`
