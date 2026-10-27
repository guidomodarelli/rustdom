# Preparación automática del paquete numérico

El workflow nuevo `numeric-composed-package-contracts.yml` usa dos jobs de veinte
minutos: transporte/Git en Windows y Linux, más ejecución del paquete Linux con
Node 22.12.0 y 24.14.1. Conserva stdout/stderr y parciales mediante `always()`.
No recompila Rust, instala dependencias ni activa capturas científicas.

La hidratación sparse deriva 810 archivos de manifests independientes: los 786
pins históricos, el artefacto seleccionado, el tar del paquete y los lectores
actuales. Requiere Git limpio, modo non-cone y `core.autocrlf=false`; agrega
patrones literales y rechaza escapes o cambios ajenos. Los siete contratos de
Git real pasaron en Windows y Linux; actionlint pasó.

## Ensayo local del flujo completo

Se copió el conjunto mínimo por bytes desde el código actual y se creó un
repositorio Git Linux real de prueba, con metadatos Linux separados. Su SHA es
un **commit de fixture**, sin presentarlo como commit publicado del método.
La hidratación real restauró los 810 inputs y dejó el fixture limpio.
`minimal-snapshot.json`, `native-sparse-fixture.json` y la corrección posterior
de fuente documentan esas identidades sin normalizar Git.

`local-job-fixed/outcomes.json` conserva seis comandos completos aprobados bajo
el entorno Git del workflow: siete contratos checkout, cinco transporte,
extracción íntegra, doce de ensamblado y probes reales en ambos SDK. Los doce
endpoints finales observaron Window/Document y wrappers por separado liberados,
con dos estados claros consecutivos. Los reportes conservan el ELF a2777cbf y
artefacto 12628261403 autenticados antes de cargar el runtime.

## Fallos previos preservados

- Windows convirtió LF a CRLF en el fixture Git inicial. La preparación ahora
  exige deshabilitar esa conversión; el negativo se ejecuta en un proceso Git
  real aislado, también bajo los overrides del CI.
- Git 2.34 no escribía explícitamente el default non-cone. Se consulta mediante
  `git config --default=false`, conservando la semántica real de Git.
- El primer flujo integral descubrió que un contrato suponía que existía
  `.cache`. Se corrigió el test para usar el padre existente del repositorio y
  ejercer el rechazo previsto por solapamiento. No cambió el ensamblador ni el
  runtime. El intento original incompleto y su stderr permanecen en `local-job/`.

Los `.py.txt` son registros de fuente; no ejecutar helpers archivados. El archivo
del paquete, SDKs y los 786 pins no cambiaron. La lectura de memoria es finita,
no mide memoria pico ni demuestra ausencia universal de fugas. El runtime sigue
híbrido; Node 22 conserva el warning de require(ESM)/parse5.

Esta evidencia es local. **La confirmación hospedada del nuevo workflow está
pendiente hasta observar sus dos jobs en el mismo SHA publicado.** No se concede
aceptación de rendimiento ni se habilita tag/merge de ownership. El protocolo
de precisión sigue siendo un trabajo técnico separado, sin captura activada.
