# Validación de la auditoría del helper de nodos

La entrega solo modifica clasificaciones, documentación y la regresión del
inventario. Producción conserva el digest de checkpoint 67:
`67523bf38c8bfd32286618de24cee952b684f32fd91a322c407f7111cd73be3f`.
`linux-copy.json` comprueba las fuentes canónicas y los bytes del test, auditoría
y documentos de evidencia copiados al filesystem Linux.

| Ejecución real | Resultado |
| --- | --- |
| Node 22.12.0, fuentes en `/mnt/c` | 6/7; el CLI de locales devolvió status null tras 30.090 ms, compatible con su timeout fijo de 30.000 ms |
| Node 24.14.1, fuentes en `/mnt/c` | 7/7; 86,33 s totales |
| Node 22.12.0, misma fuente en filesystem Linux | 7/7; 5,75 s totales |
| Node 24.14.1, misma fuente en filesystem Linux | 7/7; 5,54 s totales |
| Generación real del catálogo, Node 24.14.1 | exit 0; cuatro módulos híbridos auditados, denominadores sin cambios |

Se preservan el fallo y los resultados posteriores. No se cambió el timeout,
la implementación del generador ni las expectativas para resolver el problema.
El primer log no conserva el objeto error completo del child; el diagnóstico
de timeout se apoya en status null y duración coincidente, no en un código de
error capturado. La misma fuente pasó en almacenamiento Linux.

Los siete contratos ejercen jsdom independiente, IDs/anclas, evidencia real,
rechazo de aprobaciones Rust con pendientes, reproducción byte por byte,
CLI con locales inglés/turco y liberación de Window y Document en tres ciclos
mientras se retienen los reportes escalares. Es un control finito de la
herramienta; no certifica compatibilidad ni ausencia universal de fugas del DOM.

Los logs `node22.log` / `node24.log` son las corridas iniciales; los sufijos
`-linux.log` corresponden a la copia verificada. `generate-node24.json` conserva
el resumen y los hashes emitidos por el CLI que regeneró el catálogo.

```sh
node --test tests/validation/migration-inventory.spec.mjs
npm run inventory
```

El ledger agrega un módulo híbrido auditado; mantiene una API híbrida y una
ancla Rust completa con el alcance previo. No hay nuevas APIs migradas ni
porcentaje global. No se repiten benchmarks del motor porque sus fuentes y
bindings no cambiaron; la entrega no afirma una mejora de rendimiento.

Revisión local: reviewer nativo Codex aislado `review_name_queries`, target de
esta rama contra checkpoint 67. Verificó las siete exportaciones, el ledger y
los límites de la evidencia: cero hallazgos accionables. Solo lectura y cálculos
en memoria; no modificó archivos ni ejecutó suites o benchmarks.
