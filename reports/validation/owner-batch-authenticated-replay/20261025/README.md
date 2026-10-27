# Transporte autenticado y replay con código actual

CI40224283558 aprobó4/4jobs sobre e7895fb0. La colección original está en
reports/validation/owner-batch-integral-ci/40224283558/: ZIP íntegros, tar íntegros,
metadata API, logs, binding independiente y manifests completos. Artifact22:
12611152720, SHA1a6dcb29c7cf24701ae3e0f521fb67f5f33e4ab0dca45b3d430816f341387557;
artifact24:12611320873, SHAb96046b50c6c8cc7e9bae505e8148891ceab4f64ca4c18ef65a32d9055fe441e.

Los dos SDK lectores reprodujeron los dos tar con código actual en un Git Linux
real f781c3b7 con WIP registrado. No se altera ni se atribuye ese HEAD al productor
e7895fb0. El catálogo del productor se obtuvo como datos desde GitHub al commit
fijado; sus bytes coinciden con el blob Git publicado. Nunca se importó código de
los snapshots. Los helpers Python actuales se compilan desde bytes revisados y
registran sus propios hashes, evitando __pycache__.

Pasaron5contratos de decisión por SDK,31de reader/protocolo/datos por SDK y18Python
por sistema Windows/Linux. Las regresiones conservan outputs existentes, rechazan
pins de artifact distintos y evitan promover una captura funcional. La procedencia
final debe leerse antes de publicar complete; ENOENT real mantiene aceptación nula.
El test de caché demuestra primero que un pyc timestamp/tamaño válido ejecuta un
marcador inocuo en una copia aislada y que el extractor actual lo ignora al leer el
tar real. No hay mocks de dependencias de plataforma.

Las copias de payload se omiten de estos directorios porque sus bytes íntegros
están conservados en ZIP y tar originales, una vez por SDK productor. Cada lectura
conserva manifests, resultados completos de partes, decisiones y logs originales;
los paths registrados del entorno Linux no se normalizan ni se falsifican.

Los64workers del controlador hospedado conservan9216duraciones medidas funcionales,
3072warmup,768Window y768Document separados,192endpoints y6snapshots de padre.
Cuatro primeras rondas no fueron claras; las dos finales por proceso sí. Memoria en
reports/memory/owner-batch-hosted-controller/40224283558/. No son memoria pico ni una
prueba universal de ausencia de fugas.

Capturar32workers tomó297445.78ms enNode22 y168963.98ms enNode24. Multiplicar por32
proyecta158.64/90.11min para1024workers: es una previsión aproximada, no garantiza
el deadline170min ni sustituye las mediciones. No se cambió el presupuesto.

Se cerraron dos P2 en revisión aislada: ignorar pyc y no conservar complete/aceptación
si falla la última procedencia. La nueva ampliación requiere CI hospedado propio y
cierre de revisión antes de habilitar. Los tres flags siguenfalse; no se aplicó
etiqueta ni se ejecutó otro estudio. performanceAccepted=null,gateReevaluated=false.
Los rechazos históricos y±2%/±5% permanecen. Runtime híbrido, migración activa.
