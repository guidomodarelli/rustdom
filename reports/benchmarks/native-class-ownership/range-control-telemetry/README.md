# Preparación revisable del diagnóstico AA de Range

Estado: preparación y agenda implementadas; **captura deshabilitada**.
No se aplicó una etiqueta ni se ejecutaron DOM, samplers o profiling nuevos.
El objetivo de migración sigue pendiente; esto no añade APIs Rust completas.

La revisión prospectiva declara 256 procesos sobre las copias AA actuales,
en la fila range-control-1000/1000 y ambos Node/modos. Los parámetros están
en constants/protocol.json. Las cantidades son planificadas, no observadas.
El método no acepta rendimiento ni modifica la secuencia consumida.

Se comprobó la procedencia de los datos anteriores. El hash de fuente A de
profiles/v2 coincide con la referencia actual, pero ese perfil usa otro ELF,
worker y contexto, únicamente Node22. El perfil B también tiene otra fuente.
La traza de compilación posterior es parcial/WSL y MutationRecord/100 es otra
fila. Se conservan los sourceCommit=null y errores Git históricos, sin
rellenarlos. PROTOCOL.md delimita por qué esa evidencia no representa una
observación CPU/GC/JIT de este run y qué pregunta nueva se busca responder.

La preparación autentica los 563 pins antes de cargar el productor actual de
native-mutation-telemetry. Comprueba sus mapas de código registrados antes de
adaptar únicamente el binding de configuración: revisión y fingerprints de
los paquetes. El sampler instrumentado y wrapper de observación conservan
sus bytes. Los dos árboles finales tienen 893 archivos en cada mapa, sin
contar su recibo externo; se preservan referencias anteriores sin ejecutarlas.

Se verificó en un checkout Git Linux real con HEAD0dd82141 y ocho archivos
nuevos sin trackear: ese es el estado real de la preparación, no un commit
integrado ficticio. Los recibos conservan esa lista, el HEAD y errores Git
vacíos observados. Ambos manifiestos usan las 434 fuentes congeladas y el
HEAD real. No se reconstruyeron ni reinstalaron paquetes preparados.

Validación ejecutada:

- Cinco contratos de agenda/procedencia en Node22.12.0 y cinco en Node24.14.1.
- Los planes completos son byteidénticos entre ambos ejecutables autenticados.
- Seis contratos Python3.10 sobre las derivaciones reales CPU/JIT: mapas
  completos, binding inspeccionado en ambos Node, conservación de destino,
  inputs/HEAD inválidos y restauración de configuración scoped del intérprete.
- El wrapper real, en ambos Node/modos, rechaza captureImplemented=false
  antes de observadores o reportes. Las pruebas negativas usan entorno de
  hijo aislado para llegar a ese guard; no simulan un estudio ejecutado.
- git diff --check. No se cambiaron fuentes runtime ni los 563 pins históricos.

La evidencia íntegra está en
reports/validation/native-class-ownership/range-control-telemetry-preparation/20261025/.
Su ZIP es material de inspección; no ejecutar scripts archivados. Para
reproducir, usar las fuentes actuales y un manifiesto nuevo del checkout real:

```sh
node --test reports/benchmarks/native-class-ownership/range-control-telemetry/model.spec.cjs
node reports/benchmarks/native-class-ownership/range-control-telemetry/model.cjs
python3 -B reports/benchmarks/native-class-ownership/range-control-telemetry/prepare.py /checkout /manifest-real.json /destino-nuevo cpu
```

Faltan colector y replay nuevos, registro independiente de mapas ejecutables,
controles de historial único, workflows y revisión/CI completos antes de
habilitar la captura. La autorización permanente ya cubre esos pasos. No
pedir permiso adicional ni activar métodos antiguos. No tag/merge de ownership.
Recursos y límites en reports/memory/range-control-telemetry-preparation-20261025.md.
