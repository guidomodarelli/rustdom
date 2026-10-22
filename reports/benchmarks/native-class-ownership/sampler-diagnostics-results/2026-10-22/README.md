# Captura observacional CPU/GC completa

Método publicado y revisado en `8c6dc74b` antes de ejecutar. Diez procesos,
todos exit 0, sin reintentos: J0/A0/J1/A1/B en Node 22.12.0 y orden inverso en
24.14.1. Un paquete por proceso, CPU2 solo para el hilo principal, ocho cargas,
tres warmups y nueve muestras. Los outputs públicos de los 80 lotes coinciden
con el archivo original; la preparación oficial se verificó antes y después
de ambos Node. No hubo reconstrucción.

Se conservaron 960 intervalos (240 warmups y 720 medidos), 3.552 eventos GC y
740.753 ticks CPU. El postproceso mantiene todos los ticks y los perfiles crudos.
46.850 ticks quedan dentro de intervalos con alineación por el punto medio de
las anclas; diez intervalos no contienen ticks. La incertidumbre observada en
los extremos va de 4,58 a 24,31 µs. No es una garantía sobre errores intermedios
ni una medición exacta del tiempo de cada frame.

| Carga | Intervalos | Con solapamiento GC | Medidos con solapamiento GC |
| --- | ---: | ---: | ---: |
| mutation-records-collect/100 | 120 | 0 | 0 |
| mutation-records-collect/1000 | 120 | 0 | 0 |
| observer-delivery-records/100 | 120 | 0 | 0 |
| observer-delivery-records/1000 | 120 | 24 | 18 |
| range-control-1000/250 | 120 | 0 | 0 |
| range-control-1000/1000 | 120 | 0 | 0 |
| range-state-lifecycle-1000/250 | 120 | 0 | 0 |
| range-state-lifecycle-1000/1000 | 120 | 0 | 0 |

Los 24 solapamientos corresponden a J0/J1 en Node 22: tres warmups y nueve
muestras en cada paquete. Se informa unión de intervalos GC recortados para no
contar dos veces spans solapadas. Es coexistencia temporal, sin restar GC a los
tiempos ni atribuir causalidad. En esta captura no se observaron eventos GC
durante las operaciones de rangos; eso no demuestra qué pasó en Azure.

El lector inicial rechazó 71 deltas CPU negativos. Se conserva ese lector y su
fallo, junto con el fix: acumular los deltas y ordenar juntos timestamps e IDs,
conservando orden de origen en empates. Es el enfoque de
[CPUProfileDataModel de DevTools](https://chromium.googlesource.com/devtools/devtools-frontend/+/9a696c4e723caa3c7e1f78886da353f1f06a79b0/front_end/core/sdk/CPUProfileDataModel.ts).
No se elimina ningún tick ni se modifica el raw. El formato describe deltas
entre muestras, con el primero relativo a startTime, en el
[protocolo Profiler](https://chromedevtools.github.io/devtools-protocol/tot/Profiler/#type-Profile).
Cinco casos numéricos cubren unión GC, límites, deltas negativos y empates; el
replay completo tras extraer el helper reproduce exactamente los 960 resultados.

`analysis.json` contiene todos los intervalos, frames hoja, duraciones y relojes.
`analyze.py` reproduce su lectura; `execute.py` es el controlador usado, conservado
antes de iniciar. El archivo íntegro, fuentes derivadas y hashes están en
`reports/validation/native-class-ownership/sampler-diagnostics-capture/`.

Límites: host WSL2 Intel i7-1360P/16 CPUs visibles, distinto del Azure EPYC del
ensayo de aceptación. El profiler y la instrumentación añaden overhead. Los
ticks muestreados no prueban ausencia de trabajo, compilación o deoptimización.
Estos tiempos no se usan para comparar presupuestos ni afirmar una mejora.
El ensayo 39735778846 sigue `verified=true, accepted=false`; ownership abierto.

Siguiente paso: inspeccionar primeros y últimos intervalos y frames de rangos
de estos mismos perfiles para acotar mecanismos aún no observados. No atribuir
el rechazo de Azure a GC ni a JIT a partir de esta captura local. No ejecutar
otro contraste sin hipótesis respaldada y protocolo prospectivo revisado.
