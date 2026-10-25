# Transporte externo del estudio combinado

`transport.py` observa, conserva, autentica y extrae los bytes de una ejecución
identificada por repositorio, run, job, intento y commit. No ejecuta DOM ni código
recuperado del artefacto. Reutiliza los lectores actuales del repositorio fijados
por SHA256, incluida su configuración, sin modificar los archivos históricos.

La CLI consume un binding independiente del archivo descargado. Su revisión,
workflow, nombre de artifact, TAR y raíz deben corresponder al método combinado.
Los IDs y hashes de una ejecución futura no se inventan: deben conservarse desde
su activación y metadata API real. La verificación offline requiere además ID,
tamaño y SHA256 del ZIP/TAR. No concede aceptación científica: siempre mantiene
`performanceAccepted=null` y `gateReevaluated=false`.

Operaciones: `--observe`, `--collect`, `--verify` y `--extract`, seguidas de
repositorio, binding JSON, colección y, para extracción, un destino nuevo.
La extracción requiere Linux/WSL para preservar enlaces y rutas largas. Una
colección ajena, un alias de archivo o un destino existente se rechazan. Cada
observación y descarga interrumpida se conserva. Un TAR truncado bajo su nombre
final también se aparta antes de reconstruirlo desde el ZIP autenticado; un TAR
completo se reutiliza. Esto repite transporte, nunca mediciones.

Prueba pública de estos contratos:

```sh
python3 -B reports/benchmarks/native-class-ownership/combined-process-study/transport.spec.py
```

Los contratos leen el ZIP real del estudio histórico 40137458635 y comparan
todos los miembros extraídos con su manifiesto original fijado. Ese run conserva
su conclusión `failure`; su identidad no puede pasar por una captura científica
del método nuevo. Los cambios adversariales de metadata y bytes son entradas
del lector; no se sustituyen librerías de plataforma ni se ejecuta el sampler.

Los hashes de snapshots se calculan en bloques de 1 MiB, con límite de 64 MiB
por archivo; los ejecutables tienen su límite separado de 256 MiB. El lector de
JSON sigue limitado a 16 MiB. Los descriptores se cierran incluso ante errores
posteriores a abrir el archivo. Las pruebas de ciclos son finitas y no certifican
ausencia universal de fugas ni memoria pico.

Pendiente: cerrar el recibo revisado de activación y el vínculo de la decisión
científica con el transporte de la ejecución nueva. `executionReady=false`.
El éxito de estos contratos no habilita un merge de ownership.
