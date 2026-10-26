# Integración funcional de fixtures compartidos

Este método deriva una copia del harness congelado `97284800087ef5e3a1e53d87a338a1e366cec220e654fd289d6b02bc8d812c7b`. Reutiliza el registro de spans posterior al stop clock del diagnóstico y sustituye solo la creación de fixtures de `mutation-records-collect` y `observer-delivery-records`. Los consumidores usan los métodos de prototipo del candidato ya probado. Las cuatro filas de Range siguen por su recorrido original. El runtime preparado `5ef668c4` y los archivos originales no se modifican.

Es una **calificación funcional que invoca el sampler real**; no es una captura nueva de aceptación. Conserva todas las duraciones producidas: tres warmup y nueve medidas por proceso. No calcula ratios, medianas ni aceptación, no reevalúa el gate y no repite ni reemplaza los estudios consumidos. Los reportes tienen revisión nueva y el lector histórico los rechaza.

Antes de ejecutar DOM, `qualify.cjs` autentica el artefacto oficial, los 434 archivos congelados, ambas versiones/binarios de Node y el método con sus dependencias. Guarda sus bytes, un manifiesto y los parches. Selecciona la posición 0/seed 1 en el orden relativo original: AA completo y AB/Rustdom/B, una vez por cada combinación de cinco paquetes físicos y ocho filas. Son 40 procesos por Node, 80 en total, 960 spans y 960 pares Window/Document. Mantiene flags, afinidad, warmup por realm, entrada HTML, comprobaciones públicas y tres rondas de GC con dos estados finales liberados. Al primer error se detiene y conserva los parciales; no reintenta automáticamente.

La creación de cada fixture y las comprobaciones de identidad ocurren fuera del reloj. Cada fila de mutación o delivery debe crear y verificar 48 fixtures (12 realms × un fixture medido más tres temporales de warmup); Range debe registrar cero. Los callbacks bound tienen identidades propias con un cuerpo de destino compartido. Estos contadores no prueban estabilidad de JIT ni mejora de rendimiento.

Ejecución funcional en Linux/glibc 2.35 con los dos binarios fijados:

```sh
node24 qualify.cjs PREPARATION NEW_OUTPUT SOURCE_SHA node22 node24
node22 verify.cjs NEW_OUTPUT NEW_REPLAY22.json
node24 verify.cjs NEW_OUTPUT NEW_REPLAY24.json
SHARED_WORKER_EVIDENCE=NEW_OUTPUT node22 --test contracts.spec.cjs
SHARED_WORKER_EVIDENCE=NEW_OUTPUT node24 --test contracts.spec.cjs
```

El replay solo lee los datos; nunca ejecuta scripts archivados. Un recibo canónico versionado fuera del archivo crudo fija el índice, los snapshots originales del método y la derivación. Además contrasta el manifiesto original de 434 archivos con el grafo congelado del checkout. El lector y sus tests se corrigieron después de la calificación para cerrar un P2 de procedencia; se conservaron los bytes originales y no se repitió el sampler. La calificación se ejecutó antes de publicar el método, como prueba funcional, sin presentarla como estudio prospectivo de aceptación.

La memoria refleja observaciones finitas tras GC y baselines nativos por proceso. No representa memoria pico ni ausencia universal de fugas. Un estudio posterior de aceptación requiere un protocolo prospectivo concreto y su revisión antes de ejecutarse; esta calificación no lo autoriza ni lo sustituye.
