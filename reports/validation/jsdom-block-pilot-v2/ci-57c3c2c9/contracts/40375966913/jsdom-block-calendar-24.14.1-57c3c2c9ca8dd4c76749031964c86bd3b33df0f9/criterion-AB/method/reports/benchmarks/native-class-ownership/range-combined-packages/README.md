# Paquete calificado del candidato combinado

La matriz40168321423/intento1/SHA7d977513 aprobó seis jobs: Linux,macOS y Windows
en Node22.12.0/24.14.1. Cada job conserva22comandos,fuentes,binario,suites y probes.
Transporte íntegro en reports/validation/range-combined-ci/40168321423/;
los fallos anteriores se conservan separados e intactos.

El perfil Linuxx64/Node24 se eligió antes de medir. Artifact12589402298,
4593107bytes,ZIP811f4fed y ELF567f6bff. artifact-binding.json fija24archivos de
transporte y su identidad independiente;recalcular un ledger local no basta.
artifact.py autentica ZIP/calificación/fuentes/manifests y enumera577archivos
sin ejecutarlos. El artifact anterior12588139466 es solo fixture del lector;
su matriz fallida no califica el candidato nuevo.

baselines.cjs verifica A0/A1/J0/J1 y dependencias contra archivo/calificación y599pins.
Rechaza binarios alterados,symlinks y hardlinks que mezclan controles. assemble.py
copia controles en controls/,runtime hospedado en candidate/ y fuentes verificadas
en candidate-sources/,sin instalar,recompilar o cargar DOM. Los runtime files son
físicamente independientes;solo seis enlaces relativos resuelven dependencias.
Los inputs se verifican antes/después.
El verificador también exige directorios físicos internos y metadatos físicos:
rechaza reemplazar controles,candidato,fuentes o índices por enlaces externos.

source-binding.json conserva la procedencia real f781c3b7 y patch7fe5ec80,
338fuentes medidas y346archivos de compilador/tipos. Son scopes distintos del grafo
histórico434,que no cambia. Los snapshots de datos tienen sourceCommit=null,
sourceChanges=null y errores128 reales,separados de la identidad del compilador.
No se inventan campos Git. Preparar/extraer estos datos fuera de otros repositorios
para conservar su metadata real.

packages.tar.xz,7313440bytes/SHA5b67fcc6,contiene7824miembros y seis enlaces.
extract.py autentica archivo/manifiesto y reutiliza el extractor actual revisado
fijado por hash;nunca ejecuta código archivado. Roundtrip verificado y ejecutado
en ambos Node. Falta fijar/revisar el protocolo científico completo antes de medir.

```sh
node baselines.cjs --prepare /historico-verificado /controles-nuevos
python3 assemble.py --prepare /controles-nuevos /coleccion-calificada /fuentes-git /paquete-nuevo /node-fijado
python3 assemble.py --verify /paquete-nuevo /coleccion-calificada /node-fijado
python3 extract.py /repositorio-actual /extraccion-nueva
node --expose-gc probe.cjs /paquete-nuevo
```

Pruebas reales,sin mocks:6contratos de controles por SDK,8del lector por Python
Windows/Linux,8del ensamblado por SDK y3del extractor Windows/Linux. Cubren
corrupción con ledger recalculado,aliases físicos,metadatos Git inventados,
preservación de destinos y extracción/reverificación.
probe.cjs compara CJS/ESM con jsdom y observa6ciclos mixtos por SDK antes/después
del transporte:390StaticRange,384Range y384rechazos adicionales en los ciclos. Cada ciclo
retiene un control y exige después dos estados claros consecutivos;Window y
Document se observan por separado junto con los baselines nativos.
Los consumidores crean otros4estados nativos antes de los ciclos:los contadores
totales terminan en778creados/liberados;774es el delta de los seis ciclos.

QA en reports/validation/range-combined-packages/ y recursos en reports/memory/
range-combined-packages/. Los lectores cierran streams/ZIP/tar y usan directorios
temporales propios. Las observaciones finitas no miden pico ni prueban ausencia
universal de fugas. La calificación funcional no acepta rendimiento:
performanceAccepted=null/gateReevaluated=false. Runtime híbrido,no integrado;
migración general pendiente y rechazos históricos vigentes,sin tag/merge.
