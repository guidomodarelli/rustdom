# Revisión aislada de la planificación sintética

Revisor local `review_ownership_closeout`, solo lectura, 2026-10-26 UTC.
No ejecutó DOM, capturas ni simulaciones nuevas. Recalculó las 44000 cuadráticas
guardadas y sus clasificaciones: coinciden con ambos SDK y el README.
**Cero hallazgos materiales abiertos.**

Hashes revisados:

- `model.cjs`: `92a81628804104baa5a29a9782d0208b8e4434ad4d407025bbe5e179604bd5ec`.
- `audit.py`: `fe9a5f023791744ff01dd37b0116dbca119547b179a8a40f8c180a9e3317190c`.
- `README.md`: `778d21ce8793479b92797e540c36f08dd02fc31d9653f7a1c097cb538164867b`.

El AR(1) comienza estacionario y se reinicia entre ensayos. La dependencia
interna no se confunde con dependencia entre ensayos Monte Carlo. Wilson solo
cuantifica error Monte Carlo. El 46.85% y 68.55% son frecuencias condicionadas
a hipótesis, sin acreditar potencia del candidato. La dependencia fuerte
reduce la cobertura y permite clasificar favorablemente un efecto Rust de +6%
en 13.1% de los ensayos. Más tareas o dos intervalos sobre los mismos datos no
eliminan ese problema. No se multiplican las frecuencias por criterio para
atribuir potencia conjunta a 64 criterios. El modelo no cubre deriva, colas
adversas, cambios de runner ni toda la variación entre sesiones.

## Siguiente trabajo técnico

El revisor recomienda un **piloto prospectivo de variación entre bloques**,
con protocolo propio revisado, separado de una captura confirmatoria y sin
decisión de aceptación. Todavía no está implementado ni activado.

1. Fijar artefacto hospedado, calendario, factores, unidad y presupuesto; usar
   bloques completos balanceados, procesos nuevos y orden contrabalanceado.
2. Dimensionar réplicas según incertidumbre tolerable de varianza y costo. Dos
   bloques permiten calcularla formalmente, sin justificar estabilidad práctica.
   Los datos actuales no establecen un mínimo práctico.
3. Estimar covarianza A/B y dispersión de B−qA en los límites; bajo hipótesis
   válidas, dimensionar con un límite superior de confianza de varianza en lugar
   de una estimación puntual optimista.
4. Conservar orden y dependencia. Bloques consecutivos del mismo host no son
   independientes automáticamente. Un subconjunto de filas no dimensiona las 64.
5. Fijar después un tamaño confirmatorio nuevo, sin parada al primer verde ni
   combinación ingenua con el piloto. Si precisión, dependencia y costo no
   permiten un tamaño defendible, detener esa planificación antes de capturar.

No estimar varianza entre bloques desde la única réplica histórica ni seleccionar
efectos favorables del piloto para conservar datos. Una varianza del piloto
tampoco garantiza transferencia entre VMs. La autorización permanente sigue
vigente; faltan decisiones técnicas, no permiso del usuario.
