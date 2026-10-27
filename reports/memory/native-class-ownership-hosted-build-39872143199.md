# Memoria de la preparación oficial39872143199

El productor ejecutó tres ciclos por cada una de cinco copias físicas en
Node22.12.0 y24.14.1:15Window y15Document observados por version. Los probes
originales declaran pass=true y todos los endpoints alcanzados, con ambos tipos
de owner liberados por separado. Los contadores nativos se comparan con los
baselines del runtime preparado; no se exige que clases exportadas o contadores
históricos queden en cero.

Los JSON y trazas completos estan en el ZIP autenticado de
reports/validation/native-class-ownership/hosted-build-ci/39872143199/.
Se trata de pruebas reales del productor, no de una ejecución local nueva.
No se mide memoria pico, garantías del allocator ni ausencia absoluta de fugas.
No se suman estas observaciones a otros estudios para representar un solo
experimento y no se concede aceptación de rendimiento.
