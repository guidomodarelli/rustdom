# Gate de la evidencia actual de ownership

El CI consumía el estudio histórico row-isolation y devolvía exit2 porque sus
fuentes no correspondían al candidato actual. El nuevo consumidor verifica el
ZIP original 39921160254 ya publicado y su preparación completa; conserva
accepted=false y devuelve exit1 por el presupuesto rechazado. No es un test
funcional arreglado ni una aceptación nueva de rendimiento.

## Fronteras y verificación

- El baseline real y el checkout actual deben conservar fuentes, inputs de
  build y las 434 fuentes del arnés medido. No se sustituye el checkout por
  fuentes archivadas para obtener una coincidencia artificial.
- El extractor verifica pins independientes de ZIP, tar, manifiesto y lector
  publicado. Reutiliza el extractor revisado; compara cada miembro, tamaño,
  hash y enlace con el manifiesto completo original. Solo escribe bajo un
  temporal nuevo y propio, eliminado por el caller incluso ante rechazo.
- El verificador existente comprueba preparación, distribuciones completas,
  dependencias y probes originales, y recalcula todos los workers de ambos Node.
  Debe reproducir exactamente la decisión original, también fijada por hash.
- El CLI separa presupuesto rechazado (exit1) de integridad inválida (exit2).
  No ejecuta sampler, DOM, GC, builds ni nuevos tiempos de aceptación.

Pasaron ocho pruebas reales por Node 22.12.0 y 24.14.1: fuentes/build/arnés
actuales; copias alteradas de Rust, package.json y worker; ZIP completo y
rechazo original; ZIP alterado; Python optimizado; argumentos incompletos.
Los dos CLI conservaron 2048 procesos, 18432 duraciones, trece controles
rechazados y cero puntos Rust fuera de los límites numéricos. Sus salidas
de verificación fueron byte-idénticas, SHA256 `2282829ab40b6a1c56f415abb5ca15b3108ee0042f2ae8b6858e28e101517d0d`.

Los logs y códigos de todos los CLI quedan separados por Node. Las muestras
originales siguen en el ZIP publicado; este directorio no duplica una captura
ni agrega sus duraciones a otro estudio. actionlint aprobó el workflow.
La revisión aislada del código terminó sin hallazgos accionables.

## CI y reproducción

CI conserva los 35 contratos históricos, prueba el lector descriptivo y el
consumidor actual, y publica sus JSON incluso cuando falla el presupuesto.
El timeout de 20 minutos cubre lectura, extracción y contratos; no amplía
muestras ni warmup. El gate final sigue rojo con esta captura rechazada.

Desde Linux con los Node fijados y un checkout real de checkpoint 067:

```sh
mkdir -p .cache/current-evidence-contracts
RUSTDOM_CURRENT_OWNERSHIP_EVIDENCE_BASELINE=/ruta/checkpoint067 \
RUSTDOM_CURRENT_OWNERSHIP_EVIDENCE_TEST_OUTPUT="$PWD/.cache/current-evidence-contracts" \
node --test reports/benchmarks/native-class-ownership/current-ownership-evidence.spec.cjs
node reports/benchmarks/native-class-ownership/current-ownership-evidence.cjs \
  /ruta/checkpoint067 reports/benchmarks/native-class-ownership/current-source-results/39921160254
```

El último comando debe salir1 para estos datos. Salir2 o no emitir una decisión
completa no demuestra que se haya comprobado el presupuesto.

## Recursos, límites y decisión pendiente

El cambio solo afecta al lector de evidencia y CI; el runtime y método medidos
siguen intactos. El temporal tiene ownership y cleanup en finally; las pruebas
ejercen la ruta completa y sus errores. No se vuelve a ejecutar memoria DOM ni
se afirma ausencia universal de fugas a partir del CLI o de su terminación.

La inspección de los 2048 reportes originales confirma ausencia de eventos
por intervalo de CPU/GC/JIT. Los 474920 bytes de stderr son warnings ESM de los
1024 procesos Node22. Las trazas históricas disponibles son parciales y de otro
host/método; no identifican causalidad para el resultado actual de Azure.
Quedó pendiente la respuesta del usuario sobre autorizar un diagnóstico nuevo,
separado del estudio rechazado y sin aceptación. No se inició. No hay tag ni
merge mientras el presupuesto no esté aceptado.
