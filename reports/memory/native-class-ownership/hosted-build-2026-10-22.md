# Recursos en las distribuciones reconstruidas

Se ejercieron cinco copias físicas de paquetes DOM con Node 22.12.0 y 24.14.1,
directamente y después de trasladar el archivo. Cada worker creó quince fixtures
con parsing, mutación, clonación, Range, eventos y Unicode. Los tres addons
mantuvieron asignaciones independientes; las dos referencias usaron jsdom 27.4.0.

Los cuatro workers observaron 60 Window y 60 Document mediante referencias débiles
separadas. Sus veinte endpoints exigieron dos observaciones claras consecutivas:
40 comprobaciones finales, con los mismos contadores nativos de cada baseline.
También se rechaza un reporte real alterado para declarar claro un Document vivo.

Las trazas completas y heap/external/RSS posteriores a GC están en
[la evidencia](../../validation/native-class-ownership/hosted-build/README.md),
con resumen numérico en validation.json. Cada proceso carga cinco módulos;
esas muestras no aíslan la memoria de cada motor, no son picos y no demuestran
ausencia absoluta de fugas. El runtime y los algoritmos DOM no cambiaron.

Se conservan los intentos de desarrollo fallidos. Pasar pruebas de GC no hizo
aceptable el archivo con un enlace absoluto: su portabilidad se rechazó y se
validó de nuevo después de corregirla. No se produjo una medición de rendimiento.

## Comprobación adicional del artefacto oficial

El run `39720077911` aprobó la misma receta publicada en `2e0ae88d`.
Sus cuatro workers funcionales originales observan 60 Window y 60 Document,
20 endpoints y 40 estados finales claros exigidos. Sus reportes se autenticaron
con el UUID y las huellas recalculadas del paquete oficial; la comprobación
offline no ejecutó nuevos escenarios ni GC. Los bytes de los addons oficiales
difieren de los locales, por lo que estas observaciones se vinculan únicamente
a sus propios paquetes. Ver [recibo y resultados completos](../../validation/native-class-ownership/hosted-build-ci/39720077911/README.md).

El alcance sigue siendo finito, con cinco módulos por proceso y realm por defecto;
no demuestra ausencia universal de fugas, memoria pico ni memoria por motor.
