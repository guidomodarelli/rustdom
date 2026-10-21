# Validación del sampler pareado

No es un estudio de aceptación de rendimiento. El runtime A/B congelado sigue
sin cambios y el presupuesto de ownership continúa pendiente. No se acreditan
APIs DOM nuevas ni se concede aceptación al PR 80.

Pasaron por Node 22.12.0 y 24.14.1 Linux:

- 122 tests del harness, incluidos cuatro nuevos de observación de realms.
- 33 contratos de preflight, historia y evidencia anterior.
- Seis contratos del sampler: schedule completo, rechazo de inputs, huellas de
  paquetes reales, rechazo de dist alterado y dos workers reales con ocho filas.

Los workers de validación son Rust A/B posición 7 y jsdom A/A posición 0 en cada
Node. Son cuatro procesos, 64 lotes y 576 duraciones medidas; no cubren las ocho
posiciones factoriales del estudio previsto y corrieron junto con otros tests.
Sus duraciones no sirven para conceder aceptación ni afirmar una mejora.

Los observadores son WeakRef a dom.window y dom.window.document reales. Las
pruebas de realms guardan 28 endpoints por Node: ocho filas con jsdom, candidato
y baseline, más setup Vitest y VM para jsdom/candidato. Cada lote observa doce
pares Window/Document, incluidos tres warmups. Cada worker pareado observa 192
pares adicionales y conserva las tres rondas de limpieza por lote, comprobando
los dos runtimes. En estos escenarios se observaron 1.440 Window y 1.440 Document;
los endpoints exigidos quedaron sin supervivientes y con recursos nativos en su
baseline. No son observaciones de pico ni una prueba universal de ausencia de fugas.

En Windows Node 24 pasaron los dos contratos de schedule/inputs; cuatro casos
requieren las copias Linux y afinidad real y están explícitamente omitidos allí.
No se presenta esa ejecución como integración del sampler en Windows.

validation.json conserva fuentes, lockfiles incluidos en la identidad canónica,
hash del addon reutilizado, manifests completos de paquetes y límites. Los hashes
de las fuentes del harness actual se registran separados del runtime congelado.
Los resultados históricos permanecen intactos. El sourceHash actual es
609e73b5a7f8781ecfd0c805461ac553021be09476e762869ebd295a885e638a.

El siguiente paso es completar driver y verificador offline, congelar sus fuentes
y secuencia, terminar review y ejecutar una única comparación completa. Este
sampler y sus tests no reemplazan el gate dedicado que sigue sin aprobar.
