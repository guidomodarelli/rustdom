# Recursos en los contratos de una copia por proceso

Ocho workers reales en Node 22.12.0 y 24.14.1 observaron 768 referencias de
Window y otras 768 de Document, incluidas las de warmup. Las 192 observaciones
de limpieza están conservadas, con los ocho estados inicialmente no claros.
Los 128 endpoints finales exigidos liberaron ambos propietarios y satisficieron
los baselines nativos mediante el verificador del nuevo sampler.

Las referencias se acumulan dentro de cada worker para detectar retención de
lotes previos. Cada proceso carga una sola distribución. Se mantienen las
tres rondas de limpieza, con los últimos dos endpoints claros. No se ajustó
la limpieza a partir de los resultados ni se descartaron observaciones.

Heap JavaScript, memoria externa y RSS son estados posteriores a GC, disponibles
en cada traza; no son picos. A0/A1/C y jsdom son fixtures funcionales de orden
limitado, sin una comparación de memoria A/B balanceada. Estas pruebas no
demuestran ausencia universal de fugas ni diagnostican el RSS del allocator.
No se editó ownership del producto en este incremento.

Las [fuentes y trazas crudas](../../benchmarks/native-class-ownership/single-package-method/README.md)
se conservan separadas del ensayo completo futuro y del hosted anterior.
