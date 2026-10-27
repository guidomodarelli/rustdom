# Preparación de paquetes para collapse nativo

Esta fase ensambla y autentica los paquetes; no contiene una captura temporal
ni acepta rendimiento. El método prospectivo de medición se declarará y
revisará por separado antes de activarlo, con los presupuestos originales
±2%/±5%. La autorización permanente cubre ambas fases sin otra pregunta.
Los estudios consumidos y sus rechazos permanecen intactos.

## Identidades independientes

Se seleccionó linux-node24 del run40128890776, intento1, antes de medir.
Artifact12574603695; ZIP4058528bytes/SHA111dbbbe. El archivo original y su
API están publicados en el packet de calificación hospedada de6617ebbe.
La validación conserva las647entradas, las compara con el manifiesto
independiente y autentica cada byte antes de materializar únicamente
dist/types/package.json/package-lock.json. No ejecuta helpers archivados.

B usa el ELF43410883 y los569archivos de distribución originales del
artifact; su huella completa es0d2c0835. No se sustituye por el addon local
26ba8690 ni se reconstruye Rust. Se preserva native-build.json sin alterar
su Node24.14.1 de compilación. El ELF idéntico pasó previamente la matriz
funcional Linux con Node22.12.0 y24.14.1.

El snapshot local de fuentes procede de un checkout Git Linux real en
b63cf834 con tres archivos src modificados y hash8a7baa9c/336fuentes.
El artifact original procede de da0f4f80 con el mismo hash8a7baa9c. Son
commits diferentes y se conservan ambos. No se falsea sourceCommit,
sourceChanges ni sourceGitErrors. Las copias transportadas de las fuentes
no se presentan como checkouts Git ni reemplazan la procedencia original.

A0/A1/J0/J1 y node_modules proceden de la preparación fría autenticada
del run40065437939/artifact12549521134. El lector actual reproduce su
verificación completa antes y después de copiar. A0/A1 mantienen03568ce9;
J0/J1 mantienenc458b9e9. El package.json3c1570af y lockfilee154f202 de B
son byteidénticos a los de esa preparación; las dependencias3531archivos
mantienen149eb8f5. Por eso esta fase reutiliza esos bytes: no reinstala ni
resuelve versiones nuevas. Los cinco paquetes físicos usan enlaces
relativos internos hacia la copia compartida e íntegra de node_modules.
El grafo permitido de seis enlaces está fijado independientemente del índice
local. Las distribuciones exigen miembros regulares: un loader con bytes
idénticos enlazado hacia A0 cambiaría la resolución de Node y debe rechazarse.
El probe exige la ruta canónica packages/B y su ELF antes de crear una salida;
una captura correcta de A0 no puede presentarse como recursos de B.

## Responsabilidades y comandos

`constants/packages.json` fija la selección, identidad y límites antes de
una medición. `materialize.py` autentica y materializa datos de ZIP.
`identity.cjs` verifica paquetes/procedencia contra pins independientes;
un índice local recalculado no puede redefinir la distribución aceptada.
`prepare.cjs` coordina copias y conserva estados parciales ante errores.
`memory.cjs` ejecuta el probe actual revisado, sin cambios de bytes, en un
directorio nuevo y con resolución Node normal hacia el paquete declarado.
Solo los runtimes explícitamente evaluados se cargan; los controles del
archivo histórico no se utilizan como scripts de análisis o captura.

Ejecutar la preparación en Linux x64/glibc2.35 con uno de los Node fijados:

```text
node prepare.cjs --prepare <preparación-fría-autenticada> <fuentes-reales-del-candidato> <salida-nueva>
node prepare.cjs --verify <salida>
python3 -B materialize.py --manifest <repositorio-actual>
```

Las salidas son independientes del repositorio, fuentes y preparación
originales. Un destino existente se conserva. No hay borrado/reparación
automática de entradas ni reanudación de capturas; los fallos dejan
parciales disponibles. Python-O se rechaza antes de crear archivos porque
los contratos del lector usan assertions. No se agregan dependencias.

Los contratos usan archivos y procesos reales. Incluyen alteraciones de
JavaScript, controles, dependencias, fuentes y receipt, recalculando también
los índices para demostrar que los pins externos conservan autoridad.
Los consumidores CJS/ESM ejecutan NativeRange.collapse y comparan llamadas
públicas de Range/clone/mutación contra J0 independiente. Los procesos de
recursos reutilizan seis ciclos con controles retenidos y dos estados
finales claros; observan Window, Document, Range y NativeRange separados.
No se generan duraciones de benchmark, warmup ni muestras de aceptación.

## Límites y continuidad

El runtime sigue híbrido. Paridad con jsdom no certifica todos los estándares.
La preparación no revoca complete=false, exclusiones WPT ni fallbacks HTML
de la calificación hospedada. Los endpoints son snapshots finitos tras GC:
no memoria pico ni prueba universal de ausencia de fugas.

El siguiente método debe congelar esta identidad completa, los434archivos
del arnés, los511pins históricos y todos sus nuevos productores/lectores;
mantener filas, semillas, warmup, relojes, estimador y presupuestos declarados;
conservar todos los resultados desfavorables; y obtener revisión y checks
del SHA publicado antes de activar una secuencia única del candidato.
Esta preparación no habilita tag ni merge de ownership.
