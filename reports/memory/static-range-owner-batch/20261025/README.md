# Recursos de la variante de owners agrupados

Los JSON preservan las observaciones reales del addon local
f8c8af92763844a1128742126fbd2139b748c699a93d1c1b13245a517b3e3ec3,
construido desde Git f781c3b7 y las diez fuentes del patch cb784c2f.
El runtime continúa híbrido; esta variante no está integrada ni acepta rendimiento.

Cada SDK oficial ejecutó seis ciclos StaticRange con controles retenidos:
128 estados transitorios y uno retenido por ciclo, junto con constructores
rechazados. Se observaron Window, Document y rangos mediante WeakRef por separado.
Los controles retenidos permanecieron vivos; al soltarlos se verificó liberación
y retorno de las familias nativas al baseline. NativeRange registró 774 creados,
774 liberados y live=0 en cada SDK. También pasaron seis ciclos de collapse por SDK.

Los seis contratos nuevos ejercen el addon real con retorno inválido del resolver,
callbacks/getters que lanzan objetos, Symbol, undefined, null, NaN o -0,
reentrada y excepciones antes de la asignación de NativeRange. No hay mocks de
plataforma ni SDK. El estado nativo no se asigna hasta completar todos los callbacks
y validar los identificadores; el puente solo mantiene las referencias DOM visibles.

Los JSON conservan baselines, traces, primeras rondas, heap, memoria externa/RSS
y límites originales. Son pruebas finitas de escenarios concretos; no son memoria
pico ni garantizan ausencia universal de fugas. La retención del allocator puede
mantener RSS elevado después de liberar estados y debe distinguirse de owners vivos.
Las duraciones de tests son diagnósticas y no sustituyen un benchmark prospectivo.
