# Recursos del generador y alcance del parser

El helper real ejecutó tres ciclos por Node 22.12.0/24.14.1, conservando tres
reportes escalares completos por proceso. Observó Window y Document por separado
con WeakRef y GC explícito: seis referencias de cada tipo entre los dos logs.
Las dos rondas finales exigidas están claras, sin supervivientes. Las trazas
completas y stderr están guardados. El conjunto de tests también ejerce el
helper, sin sumar esas ejecuciones a los contadores de los logs separados.

Los 41 contratos de parser cierran sus ventanas, pero ese cierre no prueba
recolección de todos los wrappers. El helper anterior mide retención del
generador con reportes vivos; no es un estudio de todos los caminos de RcDom,
tape, scripts, custom elements o parse5. Las muestras posteriores a GC no son
picos ni prueba de ausencia universal de fugas. El RSS máximo del CLI está
separado en sus benchmarks y no se atribuye al allocator ni a una fuga nativa.

El audit y los tests no cambian ownership ni la implementación del parser.
La evidencia del módulo registra que RcDom/tape son temporales y los nodos
públicos viven en el runtime híbrido; esa inspección no completa las obligaciones
de memoria de una futura migración. No se modificó el ensayo de ownership.
