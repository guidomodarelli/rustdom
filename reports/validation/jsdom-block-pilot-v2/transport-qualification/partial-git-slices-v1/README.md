# Transporte por partes y calificación actual

La fuente de PR80 permanece en4196c496. CI propio: contratos/replays4/4,
general8/8, almacenamiento2/2 y calibración2/2. La metadata está en
`reports/validation/jsdom-block-pilot-v2/ci-4196c496/metadata/`; falta conservar
y autenticar todos sus artifacts y reproducir los replays offline actuales.
El gate40395416797 mantiene rechazo histórico39921160254:13/32 controles
sin calibración, con resultados iguales en ambos lectores. No ejecutó
mediciones nuevas ni modificó presupuestos. ZIP/metadata/logs/decisiones
íntegros están en `ci-4196c496/ownership-gate/`.

Esta prueba transportó32MiB del artifact ORIGINAL12678701780 de40375966913,
fuente57c3c2c9. No son datos científicos nuevos de4196c496. Dos segmentos de
16MiB se publicaron sinforce/retry y se leyeron desde clones independientes:
f692→6af24473→040bf83c. Su SHA256 conjunto coincide con la parte original.
Los cuatro clones desechables se retiraron tras confirmar entrega, hashes
y cierre del subárbol.76 registros de comandos no dejan descendientes propios.
Los35.640.855bytes son un snapshot de repositorios, sin medición de pico/RSS.

Los cinco casos de timeout/SIGTERM/SIGINT, incluidas señales durante cleanup,
usaron hijos y nietos desacoplados reales: diez identidades desaparecieron,
incluidos zombies. Las señales diferidas bloquean la siguiente operación.
Se reutilizan helpers de ownership revisados y fijados porSHA; no se ejecuta
código archivado. Las búsquedas de identidad del autor se omiten de logs
públicos; la identidad permanece en los commits publicados.

Los intentos anteriores y sus controles desfavorables se conservan en
`attempts/`: read-tree intentó descargar blobs anteriores y terminó por
timeout, recogiendo sus cinco procesos Git. La búsqueda implícita de blobs
de Git2.34 también se activa con partialclonefilter aunque promisor sea false.
El writer nuevo trabaja con árboles y desactiva ambas claves exclusivamente
en su bare desechable; el lector independiente sigue siendo promisor.
La prueba observó una sola adición, sin índice ni nuevos packs del padre,
y rechazó sobrescribir AGENTS.md. Los repos fallidos quedan para auditoría.
Las copias temporales Windows cuya limpieza fue rechazada siguen conservadas.

Referencias de implementación de Git2.34.1:
- https://github.com/git/git/blob/v2.34.1/builtin/mktree.c
- https://github.com/git/git/blob/v2.34.1/promisor-remote.c

`scientificCapturePreservationQualified=false`: todavía falta probar la
colección API, ZIP/tar, manifiestos y replays completos con este transporte.
La etiqueta v2 no se aplicó. El diagnóstico jsdom no acepta rendimiento Rust.
Sin tag/merge de ownership. El runtime sigue híbrido y la migración pendiente.
Los scripts preservados son evidencia como se ejecutó; no ejecutarlos desde
este archivo histórico. Usar siempre código actual revisado.
