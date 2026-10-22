# Contratos del diagnóstico y corrección de quiescencia

Validación Linux con Node 22.12.0 y 24.14.1. Por versión aprobaron dos contratos
del diagnóstico y seis de liberación de recursos. Los contratos ejercitan paquetes
reales: jsdom 27.4.0, candidato C y checkpoint67; sin mocks de plataforma.

El diagnóstico se probó con ambos módulos compartidos/independientes y posiciones
opuestas 0/7. Cada modo ejecutó los lotes públicos originales y conservó 18 muestras;
sus resultados públicos coincidieron. La integración usa una salida relativa y
comprueba la resolución absoluta de ambas raíces. Se rechazaron bytes alterados,
una identidad de módulo falsa y evidencia que declaraba libre un Document retenido.
El contrato del plan verifica las ocho posiciones y el balance del brazo líder
dentro de cada factor. **La secuencia diagnóstica de 32 procesos todavía no se ejecutó.**

Las suites de quiescencia registraron 56 endpoints, con 672 Window y 672 Document
observados por tipo entre ambos Nodes. Cada endpoint exigió dos observaciones
consecutivas claras y el baseline nativo exacto. Los 24 ciclos adicionales de la
regresión mantuvieron un Document real durante tres observaciones, lo liberaron
después y exigieron al menos cinco rondas y dos endpoints finales claros. Las
referencias retenidas persistentemente siguen rechazándose.

La suite funcional usa el límite canónico existente: 12 rondas/10 segundos.
Los workers de rendimiento mantienen sus tres rondas: no cambian sus muestras,
presupuestos o decisiones. El fallo original de CI se conserva en
[ci-quiescence-93856fdd](../ci-quiescence-93856fdd/README.md).

## Evidencia y límites

- Los cuatro logs conservan los resultados completos de los comandos de tests.
- validation.raw.tar.gz contiene los 510 archivos crudos de observación y el
  snapshot de fuentes probado, con los manifests de paquetes y ambos harnesses.
- validation.json registra hashes del código, inventario de archivos crudos,
  endpoints y la identidad del addon C. tested-harness.json conserva la lista
  exacta de fuentes del snapshot probado.
- Tras probar, solo cambió una frase del protocolo: 53 archivos totales, incluyendo
  52 bajo benchmarks y un helper. El código ejecutable coincide byte por byte
  con el snapshot. El recibo de revisión cubre también esa corrección documental.

Estos resultados son contratos funcionales y endpoints posteriores a GC. Las
duraciones de estas pruebas no aceptan ningún presupuesto de rendimiento; no
son memoria pico ni demuestran ausencia universal de fugas. No se ejecutó esta
validación local en Windows; el diagnóstico exige afinidad Linux.
