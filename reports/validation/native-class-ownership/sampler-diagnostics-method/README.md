# Contratos del diagnóstico del sampler

Validación local en WSL, Node 22.12.0 y 24.14.1. La captura observacional con
CPU profiler aún no se ejecutó; estos datos no aceptan rendimiento.

Se derivó una copia autenticada de las 387 fuentes del arnés `6904db29…`,
commit `f5526bc1`. El diff completo está en `sampler.patch`; registra intervalos
después del stop original y devuelve escalares. El wrapper añade un observer
GC externo, conserva errores y lo desconecta al terminar. Las fuentes de
producto, fixtures, relojes y decisiones de los algoritmos permanecen iguales.

Resultados:

- J0 y A0 reales en ambos Node: cuatro procesos funcionales, ocho cargas por
  proceso, 32 outputs públicos iguales a los del archivo original y 384 spans.
- Las nueve duraciones medidas son exactamente las nueve spans correspondientes;
  también se conservan los tres warmups por carga, en orden y dentro de sus relojes.
- 1.434 eventos GC escalares observados en el wrapper final; esto no es todavía análisis de su
  solapamiento con operaciones ni atribución de una causa de variación.
- Tres CLI negativos del preparador: destino existente, destino dentro de las
  fuentes y fuentes con identidad distinta. Sin sobrescribir ni crear destinos.
- Tres contratos de error por Node: engine inválido conserva error, estado incompleto
  y reloj final; repetir ese input inválido conserva los bytes de su telemetry.
  Además un observer de control confirma que un GC real, pendiente mientras el
  sampler rechaza, queda retenido por el wrapper. Sin mocks. Las seis invocaciones
  de error están separadas de los cuatro procesos funcionales.
- El arnés de aceptación actual sigue en 387 fuentes y SHA-256
  `6904db29afcddf80aca5e775ec9ebe6d2a680b11891259f3bdcc8b58f4f8ff31`.

El tar final incluye las 387 fuentes derivadas, las siete fuentes del método, manifest
original y local, preparación, patch, stdout/stderr, reportes reales, eventos GC,
memoria, comandos, errores esperados, hardware y hashes. Identidad y tamaño en
`receipt.json`. Los archivos con prefijo `initial-` conservan la validación previa
a la revisión; no son evidencia del fix final. La revisión encontró que faltaba
drenar GC al rechazar. El probe real falló antes del fix y pasa después; se
conservan ambos resultados. El fix mueve el drenaje a `finally` y mantiene el
error del sampler aunque falle el drenaje. Las cuatro ejecuciones funcionales
se repitieron con el wrapper corregido y fuentes identificadas antes de correr.

Comandos (los paths concretos también están en `processes.json`):

```text
python3 -B prepare.py FROZEN_NODE22/harness published-source-manifest.json DERIVED
node --expose-gc contracts.cjs DERIVED LOCAL_MANIFEST FROZEN_NODE_ROOT NEW_OUTPUT
python3 -B prepare-contracts.py FROZEN_NODE22/harness published-source-manifest.json DERIVED NEW_OUTPUT
node failure-contracts.cjs DERIVED LOCAL_MANIFEST NEW_OUTPUT
```

Repetir únicamente los contratos como validación funcional si cambia su código;
no confundirlos con el ensayo completo rechazado ni con las diez capturas
futuras del [protocolo](../../../benchmarks/native-class-ownership/sampler-diagnostics/PROTOCOL.md).

No se reconstruyeron addons ni se ejecutaron nuevamente Rust, Jest, Vitest o
los corpus completos para este método: no hay cambios de producto y se conserva
su validación amplia previa. El CI del commit publicado se sigue por separado.
