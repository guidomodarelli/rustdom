# Candidato actual: captura completa y presupuesto rechazado

La ejecución original [39921160254](https://github.com/guidomodarelli/rustdom/actions/runs/39921160254)
terminó sobre `eafe4109fbbf94d36d225f745bb60d716ea0c214`. Los 2048 workers
terminaron con exit0: 1024 por Node y 9216 duraciones por perfil, 18432 en total.
Los lectores existentes de Node 22.12.0 y24.14.1 verificaron preparación y datos
completos y reprodujeron el resultado original: **verified=true, accepted=false**.

Trece controles jsdom salen de ±2%: siete en Node 22 y seis en Node 24.
Ningún punto Rust sale de ±5% en AA ni supera +5% en AB. Eso no permite aceptar
el presupuesto cuando su calibración falla. No se concede aceptación parcial. Se conservaron el estimador, las
muestras, las semillas y los límites.
No repetir ni reaplicar `ownership-current-source-v1` para este candidato.

## Todas las filas

| Node | Fase | Carga | A Rust ms | B Rust ms | Rust % | Control jsdom % | Calibra |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| v22.12.0 | AA | mutation-records-collect/100 | 7.169734500 | 7.135156500 | -0.482277273 | +3.619934748 | no |
| v22.12.0 | AA | mutation-records-collect/1000 | 41.693055000 | 41.768275000 | +0.180413740 | +0.420339363 | sí |
| v22.12.0 | AA | observer-delivery-records/100 | 0.476036000 | 0.469991500 | -1.269756909 | -1.545502936 | sí |
| v22.12.0 | AA | observer-delivery-records/1000 | 2.104467500 | 2.092897500 | -0.549782784 | -1.263808274 | sí |
| v22.12.0 | AA | range-control-1000/1000 | 4.896468500 | 5.025669500 | +2.638656820 | -0.246610499 | sí |
| v22.12.0 | AA | range-control-1000/250 | 4.830546500 | 4.906132000 | +1.564740139 | +1.711625258 | sí |
| v22.12.0 | AA | range-state-lifecycle-1000/1000 | 18.774580000 | 18.733749500 | -0.217477568 | -2.742102867 | no |
| v22.12.0 | AA | range-state-lifecycle-1000/250 | 17.574642000 | 17.616389000 | +0.237541112 | -2.728422738 | no |
| v22.12.0 | AB | mutation-records-collect/100 | 7.273481500 | 7.084266000 | -2.601443339 | +3.441541869 | no |
| v22.12.0 | AB | mutation-records-collect/1000 | 42.247237500 | 42.035744500 | -0.500607880 | +0.000688367 | sí |
| v22.12.0 | AB | observer-delivery-records/100 | 0.480278500 | 0.477195500 | -0.641919220 | -2.039674202 | no |
| v22.12.0 | AB | observer-delivery-records/1000 | 2.154814500 | 2.105678000 | -2.280312296 | -0.172988158 | sí |
| v22.12.0 | AB | range-control-1000/1000 | 5.046395500 | 5.027572500 | -0.372998906 | +2.180041736 | no |
| v22.12.0 | AB | range-control-1000/250 | 4.901119000 | 4.796816500 | -2.128136452 | +1.546995379 | sí |
| v22.12.0 | AB | range-state-lifecycle-1000/1000 | 19.215358500 | 19.050833500 | -0.856216136 | +2.326876688 | no |
| v22.12.0 | AB | range-state-lifecycle-1000/250 | 17.667792000 | 17.689376500 | +0.122168633 | +1.768659917 | sí |
| v24.14.1 | AA | mutation-records-collect/100 | 4.448260500 | 4.428881500 | -0.435653443 | -7.407424120 | no |
| v24.14.1 | AA | mutation-records-collect/1000 | 49.496697000 | 49.371533000 | -0.252873439 | -2.126524152 | no |
| v24.14.1 | AA | observer-delivery-records/100 | 0.228519500 | 0.226450500 | -0.905393194 | -0.277058591 | sí |
| v24.14.1 | AA | observer-delivery-records/1000 | 2.369004000 | 2.380969500 | +0.505085682 | +0.616305278 | sí |
| v24.14.1 | AA | range-control-1000/1000 | 5.726775000 | 5.922106000 | +3.410837688 | -0.114764186 | sí |
| v24.14.1 | AA | range-control-1000/250 | 5.506850000 | 5.549370000 | +0.772129257 | +2.667375740 | no |
| v24.14.1 | AA | range-state-lifecycle-1000/1000 | 21.576221000 | 21.466504500 | -0.508506564 | -1.307599065 | sí |
| v24.14.1 | AA | range-state-lifecycle-1000/250 | 20.568239000 | 20.256090000 | -1.517626278 | -1.542205081 | sí |
| v24.14.1 | AB | mutation-records-collect/100 | 4.454072000 | 4.412038000 | -0.943720712 | -1.263684598 | sí |
| v24.14.1 | AB | mutation-records-collect/1000 | 49.340400500 | 48.828689500 | -1.037103458 | +0.096177504 | sí |
| v24.14.1 | AB | observer-delivery-records/100 | 0.226377500 | 0.228042500 | +0.735497123 | +0.429416413 | sí |
| v24.14.1 | AB | observer-delivery-records/1000 | 2.299383500 | 2.343072000 | +1.900009285 | +0.201945222 | sí |
| v24.14.1 | AB | range-control-1000/1000 | 5.695428500 | 5.620507500 | -1.315458530 | -0.753802597 | sí |
| v24.14.1 | AB | range-control-1000/250 | 5.675585000 | 5.476836500 | -3.501815231 | -4.019040025 | no |
| v24.14.1 | AB | range-state-lifecycle-1000/1000 | 21.209076500 | 21.091306000 | -0.555283489 | -2.095250519 | no |
| v24.14.1 | AB | range-state-lifecycle-1000/250 | 20.349758500 | 20.461807500 | +0.550615871 | -2.764111978 | no |

## Alcance e integridad

A es checkpoint 067/fuente `67523bf3`; B es la implementación real `5ef668c4`
compilada en la preparación 39906777389, UUID `b1412b0b-da1f-4147-9879-c38a821b43da`.
El delta incluye el guard de ownership y las propiedades XML nativas. La
aceptación XML separada no acepta este presupuesto de ownership.
El arnés `97284800` conserva 434 fuentes por Node: 868 comparaciones contra el
grafo revisado publicado. Las fuentes, inputs de raíz, dependencias y cinco
distribuciones completas de la preparación también se verificaron.

Host: INTEL(R) XEON(R) PLATINUM 8573C, cuatro CPUs lógicas, Linux 6.8.0-1064-azure,
glibc 2.35, Rust 1.99.1. Se mantuvieron CPU 2, las ocho cargas, dos fases,
dieciséis posiciones, semillas 1..16, tres warmups exteriores y nueve muestras
por lote. Se conservaron la configuración de warmup y todos los datos de
recursos disponibles; no se inventan tiempos de warmup no registrados.

El ZIP oficial tiene 25045959 bytes, SHA256
`97cd554d9a56c62005cd2ce303898b160fd329fe107950dce2d6c7cfb93e7d79`.
Su tar.xz tiene 25106720 bytes, SHA256
`84ca6f6185f139e1598bda59e2f6719890222b779286a696059c14945e516292`.
Se preservan 14058 archivos regulares / 1392246717 bytes y seis enlaces relativos.
raw-members.json.gz autentica cada miembro; el ZIP no fue recomprimido.
process-samples.json.gz conserva las 18432 duraciones en su orden original,
con motor, posición, semilla, etiqueta, copia física y reporte de procedencia.

## Reproducción

Usar el código revisado eafe4109 en Linux y los Node fijados, sin flags ajenos.
Desde este directorio, verificar el transporte y extraerlo en rutas nuevas:

```sh
sha256sum --check artifact.zip.sha256
mkdir transport capture
unzip artifact.zip -d transport
tar -xJf transport/ownership-current-results.tar.xz -C capture
```

Desde la raíz del checkout, con las rutas extraídas absolutas:

```sh
node reports/benchmarks/native-class-ownership/current-ownership-experiment.cjs --inspect /ruta/capture/ownership-current/preparation/ownership-build
node reports/benchmarks/native-class-ownership/current-ownership-experiment.cjs --verify-set /ruta/capture/ownership-current/node-22 /ruta/capture/ownership-current/node-24
```

El verificador de integridad sale 0 incluso con accepted=false; eso no es un
gate de rendimiento aprobado. No ejecutar el modo productor para recalcular.
Los scripts copiados documentan la recolección realizada en esta máquina;
algunos contienen sus rutas operativas. Las instrucciones anteriores usan
los lectores existentes y no ejecutan muestras nuevas.

El CI general de `eafe4109` aprobó sus ocho jobs; eso no concede aceptación de
rendimiento. Los dos hilos de review de GitHub están resueltos. El objetivo
total de Rust permanece pendiente; no hay tag ni merge de ownership.

## Memoria

Se observaron 24576 Window y 24576 Document por separado,
incluidos 6144 owners de warmup por tipo. Los 4096 endpoints
finales requeridos quedaron claros antes de terminar sus workers. Se conservan
también las rondas iniciales no claras y los rangos de RSS/heap/external.
En los workers rustdom, `napiClasses.live=22` coincide con baseline 22;
no se afirma que todas las clases vivas terminaron en cero. Son pruebas finitas con snapshots después de GC,
no memoria pico ni ausencia universal de fugas. Ver el reporte separado.
