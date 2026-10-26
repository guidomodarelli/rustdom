# Límite del análisis de recursos del piloto v1

El run 40366685759 falló en la preparación de los 32 criterios. La auditoría
íntegra está en `reports/benchmarks/native-class-ownership/jsdom-block-pilot-results/40366685759/`.
No inició workers de benchmark ni registró snapshots del padre, endpoints de
Window/Document, warmup o duraciones. Por lo tanto no permite inferir retención,
memoria pico ni ausencia de fugas. Los journals del supervisor preservan el
exit 2 del padre y sus listas finales de descendientes; no se sustituyen por
mediciones de memoria.

El CI general 40357510284 conserva aparte el Memcheck de 311 tests Rust en diez
batches. Su alcance es el ejecutable de tests Rust, no V8 ni el addon cargado.
Conservar también asignaciones posibles y alcanzables de sus logs originales.
