# Realms nuevos emparejados: resultado completo sin aceptación

La única secuencia fijada terminó entre 2026-10-21T18:15:36.759Z y 2026-10-21T18:28:13.862Z, con exit 1.

Node v22.12.0, V8 12.4.254.21-node.21; linux/x64, 13th Gen Intel(R) Core(TM) i7-1360P, 16 CPUs lógicas, afinidad CPU 2.

Se completaron y verificaron 32 procesos, 1.152 duraciones y 1.536.000 copias incluyendo warmups. Todas las salidas coinciden con el corpus original. Las 1.536 observaciones conservan sus tres rondas de limpieza: los últimos dos endpoints de Window/Document quedan claros, y los contadores nativos regresan a cero. Son observaciones finitas posteriores a GC, no memoria pico ni una garantía universal de ausencia de fugas.

| Fase | Tamaño | Rust Δ% | Control jsdom Δ% | Calibración |
| --- | ---: | ---: | ---: | --- |
| A/A | 250 | -9.3877 | 105.2222 | No calibra |
| A/A | 1000 | -6.8094 | -1.3976 | No calibra |
| A/B | 250 | -6.5941 | -38.0951 | No calibra |
| A/B | 1000 | 2.0522 | -0.9004 | Calibra |

A/A falla en ambos tamaños. La fila A/B de 1.000 queda dentro del presupuesto, pero no compensa una calibración rechazada. accepted=false y el exit 1 se conservan. Emparejar procesos no alcanzó para validar el presupuesto completo; no se relanza esta misma secuencia según sus resultados.

La implementación de este diseño carga A antes de B y asigna copias físicas fijas a las etiquetas; sí contrabalancea el orden de muestras y tamaños. Estos aspectos del contexto deben considerarse antes de atribuir diferencias al SDK. Esta observación no demuestra por sí sola la causa de la variación.

El árbol de código publicado en ec80a0e4 contiene los mismos seis archivos congelados antes de medir. Los hashes volvieron a coincidir al terminar. Los fingerprints de paquetes y fuentes se comprobaron antes/después; index.json conserva sus datos completos. La validación funcional previa y sus fallos preliminares están en reports/validation/native-class-ownership/paired-method/.

```sh
node reports/benchmarks/native-class-ownership/paired-experiment.cjs --verify \
  reports/benchmarks/native-class-ownership/paired/2026-10-21
```

El comando verifica fidelidad y devuelve accepted=false; no aprueba el presupuesto. Los resultados independientes anteriores siguen archivados y su gate no cambia. El hito de ownership y el objetivo global continúan abiertos.
