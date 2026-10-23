# Calificación funcional del worker derivado

La única ejecución de esta matriz produjo 80 procesos exit0, 960 spans
(240 warmup + 720 medidos) y 960 pares Window/Document. Todos los hashes
públicos coinciden con el jsdom independiente original. Los consumidores
compartidos se ejercieron 48 veces por fila de mutación/delivery y cero en
Range. Se preservaron preparación, HTML, primeras mutaciones, orden, seed1,
afinidad, warmup y endpoints originales. No se infiere mejora de rendimiento.

qualification.tar.xz contiene los 784 archivos originales, 61981992 bytes
sin comprimir, incluidos logs, reportes, spans, snapshots del método, copia
de los 434 archivos congelados y los dos parches. Sus 874000 bytes tienen SHA256
`955c0b75b7aaf5f1f87ccc534ecfa9fa29856c14d3c67bd47e6a951d91f4c28d`.
receipt.json y raw-members.json.gz fijan los bytes; los originales no se normalizaron.

La ejecución usó el checkout 9fd76b16 más el método nuevo aún sin publicar.
No es un estudio prospectivo de aceptación. Después se corrigió un P2 del
lector offline: los hashes autocontenidos ahora deben coincidir con el recibo
canónico versionado en este checkout, y el manifiesto con el grafo congelado.
Los snapshots antiguos se conservaron y no se repitió la ejecución. Los tests
rechazan sustituciones coherentes, PID/Node falsos, método omitido, salida
falsa, spans incompletos, Window ausente y reutilización en el gate histórico.

Para leer en otra máquina con Python 3.12 y Node 22 o 24:

```sh
python reports/validation/native-class-ownership/shared-fixture-worker/replay.py /tmp/new-shared-worker
node reports/benchmarks/native-class-ownership/shared-fixture-worker/verify.cjs /tmp/new-shared-worker/shared-worker-qualification /tmp/new-replay.json
SHARED_WORKER_EVIDENCE=/tmp/new-shared-worker/shared-worker-qualification node --test reports/benchmarks/native-class-ownership/shared-fixture-worker/contracts.spec.cjs
```

replay.py verifica el SHA del archivo antes de extraerlo con el extractor seguro
publicado. El lector solo usa código del checkout: nunca ejecuta scripts archivados.
Los dos replays produjeron bytes idénticos; 15 contratos por Node pasaron.
SHA del resumen: `f44053b0dda5e7894495083dbb49709e164c5c107bc586266d5ecc7d4211690d`.

Memoria: nueve primeras rondas no claras conservadas y 160 estados finales
claros; baselines nativos preservados. El informe de reports/memory detalla
alcance y límites. Ownership histórico sigue accepted=false; esta calificación
es performanceAccepted=null. No habilita tag ni merge.
