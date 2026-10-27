# Auditoría integrada de DOMImplementation

Esta auditoría clasifica la implementación existente; no agrega lógica al runtime
ni altera el estudio científico en curso. Las once clasificaciones se integraron
en el catálogo canónico con su contrato actualizado. El módulo y sus cuatro métodos públicos
siguen híbridos por WebIDL, factories, creación de excepciones, elementos y entrega
de mutaciones en JavaScript. El constructor público ilegal sigue pendiente.

La única ancla propuesta como Rust completo es el cuerpo hasFeature de la referencia:
su decisión de devolver true la ejecuta DocumentImplementationOperation::HasFeature
en Rust, sin leer argumentos ni propietarios. Esta clasificación no acredita el
constructor, la validación pública de receiver ni las dependencias de otros métodos.
El constructor interno conserva propietarios en JavaScript; las otras tres anclas
dependen de factories y efectos híbridos. No se afirma una migración nueva de código.

Los denominadores permanecen 531 módulos, 4331 APIs y 7246 anclas, por separado.
El alcance de algoritmos semánticos y dependencias externas sigue abierto; no hay
un porcentaje de migración defendible. La auditoría suma una clasificación de módulo,
cinco APIs y cinco anclas. El catálogo total tiene siete módulos, 37 APIs y seis
anclas auditados. Ningún módulo completo se acredita como Rust completo.

Se ejecutaron 164 contratos diferenciales por Node 22.12.0/24.14.1, incluidos
constructores ilegales, receiver, argumentos ignorados, realms, QName, efectos,
reentrada, errores y fixtures WPT de contexto separado. Los contadores del addon
real confirman tres entradas nativas para las tres llamadas válidas de hasFeature,
sin lecturas del propietario ni coerciones de argumentos ignorados. Los siete
contratos del inventario y el CLI real pasaron en ambos SDK antes de integrar.
Tras actualizar el ledger y su prueba, pasaron nuevamente los siete contratos y
el CLI canónico por SDK: los cuatro catálogos independientes del perfil de Node
coinciden byte por byte con los publicados y Node 24 reproduce también surface.json.

El SUT fue el baseline A0 preparado y autenticado íntegramente, con cuatro fuentes
DOMImplementation idénticas a las actuales, incluido scripts/build.mjs. No se le
atribuye el guard de ownership ni el candidato de Range aislado. No se reinstaló
ni reconstruyó el paquete. La referencia independiente fue jsdom 27.4.0. Los
helpers/test y el generador son fuentes actuales; los ZIP son evidencia, no código
para ejecutar. El recibo registra fuente Git real y cambios sin commitear reales.

qa.zip conserva 88 miembros con resultados disponibles de los intentos, catálogos,
logs y fuentes de prueba. El primer escaneo sobre el montaje Windows se interrumpió
por demora; los contratos de producto y memoria habían pasado. Un checkout Linux
inicial omitía metadata y luego faltó inventory-memory.cjs: el intento 6/7 queda
visible. Al materializar el helper existente pasan 7/7, sin cambiar assertions.
setup-observations.json distingue las observaciones de arranque transcritas de los
logs originales conservados. integration-replay.zip conserva 32 miembros del replay
posterior a la integración. Ambos manifiestos y hashes están en los JSON vecinos.

source-map.json conserva el estado previo a integrar; integration.json registra
la unión, los 39 registros anteriores intactos y los nuevos hashes. Se comprobó
que ni el ledger ni su test están entre los 599 pins, las 724 fuentes científicas
o las 738 dependencias del lector. El runtime y el método permanecen intactos.

La prueba de recursos por SDK cubrió doce ciclos de creación/retención/liberación,
con 100 documentos por ciclo, ambos engines y dos modos de realm. Observa Window,
documento propietario, documentos creados y otros propietarios por separado, con
baselines nativos. Los reportes íntegros están en reports/memory/inventory-document-implementation/20261025/.
No prueba memoria pico ni ausencia universal de fugas, ni acepta rendimiento.
