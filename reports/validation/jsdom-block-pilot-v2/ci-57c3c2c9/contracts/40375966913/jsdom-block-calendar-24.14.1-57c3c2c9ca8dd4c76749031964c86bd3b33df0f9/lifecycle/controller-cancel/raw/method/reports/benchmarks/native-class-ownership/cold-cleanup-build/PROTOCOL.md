# Preparación independiente del candidato con limpieza fría

Esta preparación construye paquetes; no contiene un sampler, no solicita una
captura y no acepta rendimiento. Las autorizaciones de los estudios anteriores
están consumidas. El runtime principal y sus 434 archivos congelados no cambian.

El candidato añade únicamente `cold` e `inline(never)` al Drop del guard aún no
transferido. La evidencia publicada en fb4bb26c y 8dba217b conserva sus pruebas
Rust, addon, memoria finita y suites Linux Node22/24. La reducción estática de
32 bytes no demuestra una mejora temporal ni explica los controles jsdom fallidos.

## Fuentes y herramientas fijadas

- A: checkpoint067, commit 3d37f89976a48203e80cc5c435e099267f4ce346
  (objeto tag c869f3c085231edc4b958c21d05abb143b9e6f4e),
  sourceHash67523bf38c8bfd32286618de24cee952b684f32fd91a322c407f7111cd73be3f.
- Candidato B: checkout real de 8dba217bc46d601f8798ce89f6edc3c0b841454e,
  fuente original5ef668c4; aplicar exclusivamente el patch publicado d869ec4a.
  Resultado esperado5273aae0ea6efc9f1cc36ce1c76e8906abe055b3dfb11817f3a82c5939a67771.
  Los hashes completos del guard, patch y entradas están en constants/inputs.json.
- El harness de build heredado contiene360archivos y su variante queda fijada
  por a339717a5c12e617bd75e171d1b0ceaf764a7adcaf2691934acc09bba5f18052.
  Es un alcance distinto del gráfico434 del estudio consumido, que permanece
  intacto; no se suman ni se confunden esos denominadores. Los archivos nuevos
  del productor se autentican además contra el código actual revisado.
- Node de build24.14.1/npm11.11.0, Rust/Cargo1.99.1, Ubuntu22.04/glibc2.35/x64.
  Se conserva la receta original: npm ci --omit=dev y npm run build, los flags,
  límites, ausencia de configuraciones Cargo y rechazos de overrides heredados.
  No normalizar sourceCommit/sourceChanges/sourceGitErrors.

Se reutiliza el productor existente, con una revisión de entradas separada.
El patch requiere el checkout limpio declarado antes de escribir y no puede
reaplicarse. Los inputs de build deben ser los publicados; el único cambio de
fuentes respecto del candidato8dba217b es el guard calificado; no se afirma que
todo el PR difiera del baseline067 solo por esos dos atributos. La preparación registra ambos
checkouts, comandos completos, herramientas, dependencias, fuentes y todos los
paquetes A0/A1/B/J0/J1. A0/A1 son copias idénticas; J0/J1 usan jsdom27.4.0
independiente. Las huellas cubren dist y package.json completos, no solo el addon.

La lectura comprueba todos los archivos y enlaces relativos, los inputs fijados
y las fuentes archivadas del productor contra el código actual revisado. Cambiar
un controlador y reseñar su hash dentro del mismo índice no concede confianza.
La autenticación futura del artifact por run/SHA/intento/ID/digest seguirá siendo
necesaria: consistencia interna no demuestra por sí sola su procedencia de CI.

## Calificación funcional y recursos

El worker existente ejecuta tres ciclos por cada uno de los cinco paquetes en
Node22.12.0 y24.14.1. Compara mutación, clonación, Range, eventos y Unicode real;
verifica el aislamiento de contadores nativos. Son15 Window y15 Document por
Node, observados por separado con WeakRef, y dos estados claros contra el
baseline por paquete. Preservar todas las rondas, incluyendo primeras no claras.
No son memoria pico ni garantía universal de ausencia de fugas.

Los contratos ejercen los paquetes reales, CLI, relocalización con carga del
runtime, identidad y endpoints. Las copias dañadas deben rechazarse sin alterar
el archivo original. No se simulan compiladores, SDKs ni bibliotecas internas.
Conservar logs y parciales de cualquier fallo; no convertirlos en éxito.

El workflow automático de preparación no ejecuta benchmarks ni etiquetas de los
estudios consumidos. Conserva siempre su archivo íntegro y sus reportes. No crea
tags, no mergea ni modifica el gate histórico. El siguiente paso será publicar
el recibo autenticado de esta preparación y preparar un método prospectivo nuevo
con agenda, estimador y presupuestos originales antes de pedir autorización
independiente para una única secuencia. No usar un resultado de build o pruebas
funcionales como aceptación de rendimiento.
