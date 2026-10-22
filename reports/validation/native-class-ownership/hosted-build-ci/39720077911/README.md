# Preparación oficial de paquetes, sin medición de rendimiento

El [run 39720077911](https://github.com/guidomodarelli/rustdom/actions/runs/39720077911)
terminó con éxito sobre `2e0ae88d7afee89b1e900d36b6bd22d51dd7fb99`.
El artefacto oficial `12400802735` se conserva completo en este directorio:
14.943.805 bytes, SHA-256
`b25f1e98608c6abb50cb9a5c9feb00f825276941511f3ed9905c457480582610`.
La huella coincide con el digest publicado por GitHub en `artifacts.json`.
`run.json`, `jobs.json` y `job.log.gz` conservan la procedencia y los resultados.

La preparación tiene UUID `99fb5dd8-2ee8-402c-97b4-d8174069f933`.
Su tar, dentro del ZIP, conserva paquetes DOM completos, dependencias, fuentes,
inputs, logs y los seis enlaces relativos. Las dos verificaciones offline usan
el verificador incluido en ese mismo archivo y pasan en Node 22.12.0 y 24.14.1.
No ejecutan DOM, compilaciones ni benchmarks. Los comandos y salidas originales
están en `offline-processes.json` y `node*-offline.*`.

Los cuatro reportes funcionales originales de CI —dos directos y dos trasladados—
se comprobaron con `verifyFunctionalReport` y la identidad recalculada del tar.
Coinciden UUID, fuentes, paquetes y dependencias: 60 observaciones de Window y
60 de Document, 20 endpoints y 40 estados finales claros exigidos. Los logs
incluidos en el ZIP registran 17 contratos aprobados por Node, sin exclusiones.
Son escenarios finitos del realm por defecto; no prueban ausencia universal de
fugas ni memoria pico. `functional-replay.*` conserva la comprobación offline.

| Distribución | SHA-256 oficial |
|---|---|
| A0 y A1, checkpoint067 | `03568ce9e6faeab820d31cff7b6e5e7f576fa8b6f61aecfcc02eadb191f9a374` |
| B, candidato C | `99c07d9b78884cbf2a62b2c46240b29e751dedf86c30128563addab54d679752` |
| J0 y J1, jsdom 27.4.0 | `c458b9e9ca38d2f0af6fdf0d7277f7d6499c723ffab361216bfdc119386d9078` |

A y C difieren de sus paquetes locales anteriores únicamente en
`dist/rustdom.node` y `dist/native-build.json`. No se los presenta como paquetes
idénticos a los locales. Todos sus JavaScript y package.json coinciden; jsdom
y la huella de dependencias también coinciden. `receipt.json` fija estos nuevos
paquetes y los hashes de cada entrada del ZIP antes de cualquier medición futura.

La primera extracción local con `data_filter` del Python 3.10 instalado rechazó
los enlaces relativos válidos: su backport resuelve el destino contra la raíz
de extracción en vez del directorio del enlace. No se cambió el artefacto.
Antes de extraer se comprobaron todos los nombres/tipos, los seis destinos
exactos, su pertenencia al directorio y la ausencia de entradas bajo enlaces;
se utilizó después `tar_filter`. El verificador congelado volvió a comprobar
el confinamiento real de los enlaces y todos los bytes en ambos Node.

`measurementExecuted=false` y `performanceAccepted=null`. El estudio C anterior
mantiene `accepted=false`; este build no modifica sus presupuestos ni resultados.
No suma APIs migradas y no autoriza merge o checkpoint de ownership.
