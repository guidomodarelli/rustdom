# Cobertura de límites de mutación de Range (PR 23)

Se atendieron los hallazgos `3996622838` y `3996622841` con pruebas de
comportamiento sobre el addon real y un jsdom 27.4.0 independiente. El cambio
solo amplía `tests/range-mutations.spec.cjs` y agrega esta evidencia.

La matriz pasa de 10 a 14 puntos: incluye `[root, 2]`, el índice del subtree
eliminado, y los offsets 0, 3 y 6 del Text adyacente `joined`. Cada una de las
12 mutaciones opera sobre 196 rangos vivos, sus clones y sus StaticRange,
comparando extremos, DOM y registros de MutationObserver entre motores.

Dos regresiones explícitas comprueban:

- `normalize()` mueve el extremo de un rango que abarca el Text retenido y
  `joined` al nodo retenido, sumando su longitud UTF-16. Una mutación posterior
  sigue actualizando el rango y su clon. Los rangos solo contenidos en `joined`
  terminan en el padre según el comportamiento fijado de jsdom; no se modifica
  ese contrato. StaticRange conserva el nodo desconectado y sus offsets.
- Al eliminar el hijo de índice 2, un extremo en el padre con offset 2 conserva
  ese valor y el extremo con offset 3 baja a 2. Se comprueban identidades,
  colapso, clon vivo, snapshot previo y StaticRange independiente.

Validación ejecutada en un clone nuevo de
`9f22195f69a331adb8da7c3e1fbd55987ff38bae`, con `dist` y `target` propios:

| Comando | Resultado |
|---|---|
| `npm run build` | Cargo release con lockfile y construcción JS aprobados |
| `node --test tests/range-mutations.spec.cjs`, Node 24.14.1 | 7/7 aprobados ([log](node24-tests.log)) |
| `node --test tests/range-mutations.spec.cjs`, Node 22.12.0 | 7/7 aprobados ([log](node22-tests.log)) |
| `npm test`, Node 24.14.1 | 305 Node, 7 Jest, 11 Vitest y 4 VM aprobados ([log](node24-integrations.log)) |
| `git diff --check` | Aprobado |

Los [fingerprints](fingerprints.json) verifican que las fuentes medidas del
[benchmark optimizado](../../benchmarks/2026-09-12T14-39-16.652Z-linux-x64.json)
conservan exactamente el SHA-256
`fcd63929549d3058a6eb0e461e21eb107e0cb81d86596823d36dc3bfa2500740`.
También coinciden las fuentes de entorno, worker y endpoint del
[estrés de memoria](../../memory/2026-09-12T14-50-02.309Z-linux-x64.json).
Se reutiliza esa evidencia porque no cambian producción, ownership, dependencias
ni workloads; no se ejecutó un benchmark nuevo ni se atribuye una mejora de
rendimiento a este cambio de tests. El binario del clone tiene un hash distinto
al recompilar en otra ubicación, registrado aparte; no se presenta como el
binario de aquellas mediciones. Las pruebas de memoria siguen siendo finitas.

La validación Windows de estos tests queda a cargo del CI del nuevo SHA: no
había un addon Windows verificado de este candidato para ejecutarlos localmente.
No se sustituyó por el addon Linux ni por outputs del checkout principal.
