# Presupuesto y diagnóstico de benchmarks

El job `103644774634` del run `34727732316`, sobre `67391a14e8057e7867f6f04fdd543bc34ae6b4c3`, falló después de cinco minutos en el primer proceso de **jsdom** con `spawnSync ETIMEDOUT`. El job `103644769270` del run `34727730093` pasó sobre el mismo SHA. Se conserva el log original en `ci-failure.log`.

Cada proceso ejecuta todo el plan seleccionado, incluida preparación y limpieza fuera de las mediciones. El límite anterior de 300.000 ms resultaba insuficiente en ese runner. El presupuesto predeterminado pasa a 600.000 ms por proceso y puede configurarse mediante `RUSTDOM_BENCHMARK_TIMEOUT_MS`, un entero positivo seguro en milisegundos. No cambian fixtures, tres warmups, nueve muestras por proceso, orden alternado ni aserciones de equivalencia.

Un fallo preserva los procesos completos previos, `complete: false`, motor, número de proceso, tiempo transcurrido, presupuesto, exit code, señal, error y salidas capturadas. El worker registra comienzo y final de cada workload fuera del intervalo medido; el artefacto permite identificar el último workload iniciado. CI sube los informes incluso si el job falla. Un informe completo solo se marca después de comparar resultados de ambos motores.

## Validación local

`node --test tests/benchmarks/runner.spec.cjs`: **4/4 PASS**, Linux, Node 24.14.1, 47,43 segundos. Integra el CLI y procesos reales, sin mocks:

- Rechaza presupuestos cero, negativos, fraccionarios, no numéricos, infinitos, inseguros y vacíos.
- Un presupuesto de 1 ms termina el worker real con `ETIMEDOUT` y guarda el diagnóstico incompleto: `2026-09-13T01-02-08.077Z-linux-x64-failed.json`.
- Un workload desconocido conserva el exit code y stderr sin clasificarlo como timeout: `2026-09-13T01-02-17.339Z-linux-x64-failed.json`.
- `shadow-hosts-create-100` termina con cuatro procesos, 18 muestras por motor y hashes iguales: `2026-09-13T01-02-53.804Z-linux-x64.json` y `.md`.

Los informes están en `reports/benchmarks/`. La ejecución local usa el addon de retargeting en preparación, identificado por el hash binario y los cambios de fuente del informe; valida el contrato del CLI y no se presenta como benchmark del SHA de hosts. El plan completo del SHA publicado debe pasar en CI antes de mergear.

El cambio de infraestructura no agrega estado persistente al DOM. Los procesos terminan en los casos probados y las capturas tienen un límite de 16 MiB; esto no sustituye las pruebas de memoria del runtime.
