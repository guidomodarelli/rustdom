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

`--method-identity` seguido del repositorio publica el SHA del recibo y el digest
UTF8 JSON de sus entradas ordenadas. Python y Node deben coincidir. El binding
independiente conserva ambos valores; nunca los obtiene del archivo descargado.

`activation.cjs` exige el workflow CI exacto aprobado sobre el mismo SHA,
conserva las respuestas API y fija el run/job real antes de medir. El payload
preserva su binding inmutable. El binding final agrega ID/tamaño/hash del artifact
autenticado, conservando los campos originales.

`decision.cjs` recibe binding JSON independiente, colección y destino nuevo.
Extrae nuevamente desde los bytes autenticados, verifica el payload íntegro y su
identidad, lee el log de progreso más resultado terminal y contrasta exit-code y
conclusiones API. Conserva todo ante errores. No ejecuta código del archivo.
La prueba positiva integral depende de la futura captura real de 2048 procesos;
ni los 64 funcionales ni los fixtures sintéticos pueden reemplazarla.

El método declarado queda habilitado con recibo y CI obligatorios; no se activa
por ese flag ni acepta rendimiento mediante sus contratos. El éxito de estos
contratos no habilita un merge de ownership.
