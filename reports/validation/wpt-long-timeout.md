# Presupuesto externo del arnés WPT

El job Windows de [CI 34701004762](https://github.com/guidomodarelli/rustdom/actions/runs/34701004762/job/103572642740)
pasó 105 tests Rust, los contratos Node y runners, pero el runner externo
interrumpió Range-mutations-dataChange.html con `WPT timeout` después de su
presupuesto de 30 segundos. El [reporte original](../compatibility/2026-09-12T15-04-48.082Z-win32-wpt.json)
conserva el fallo; no contiene un resultado DOM divergente para ese archivo
porque la ejecución se interrumpió antes de obtener la comparación completa.

La fixture original declara `<meta name=timeout content=long>`. El
testharness.js fijado concede 60 segundos a long y 10 a normal; el failsafe
externo de 30 segundos podía cortar un test antes del plazo que le corresponde.

El guard externo ahora permite los 60 segundos de long más 30 segundos de
margen para arranque/carga del documento. El testharness original sigue
imponiendo sus propios límites normal/long. No se alteran fixtures, assertions,
resultados esperados, integridad de hashes ni la declaración del bootstrap
CDATA bloqueado. Los nuevos reportes guardan outerTimeoutMs para identificar
el presupuesto realmente utilizado.

La [repetición real de range-state](../compatibility/2026-09-12T15-20-28.557Z-linux-wpt.json)
pasó en Linux con el nuevo guard, incluidos los 2.808 casos de dataChange
que quedaron interrumpidos en Windows. Se ejercieron las assertions originales
de ambos motores y se conservaron los fallos compartidos; no se sustituyó
el motor ni se simuló el reloj. El presupuesto externo utilizado queda
registrado como 90.000 ms. El checkout local incluía el contexto Range en
desarrollo; este fix publicado contiene solo el cambio del runner y su
evidencia. El nuevo SHA en CI debe verificar Windows directamente.
