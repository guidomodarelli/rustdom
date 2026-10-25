# Preparación de diagnóstico de calibración de Range

Revisión `range-control-aa-telemetry-v1`. La autorización permanente del usuario
cubre este trabajo sin otra pregunta. La captura permanece deshabilitada hasta
que el método íntegro, los lectores, sus mapas derivados y los workflows estén
implementados, publicados, probados y revisados. La preparación no ejecuta DOM.

## Pregunta y procedencia

El estudio 40137458635 terminó completo/rechazado: 17 controles jsdom fuera de
±2% y una desviación AA Rust Node22 range-control-1000/1000 de -11,442393%.
El desglose offline conserva todos los pares; las dos variantes AA son copias
del baseline. No es evidencia de una regresión del candidato ni una causa JIT.

Los perfiles `profiles/v2/` usan Node22 y ELF A=e1781424/B=04863365,
worker original444320a7 y fuente B83322767. A mantiene sourceCommit=null y sus
errores Git originales. El estudio nuevo usó otros binarios, sampler d24c7282
y configuración; no se transfieren tiempos, identidad o causalidad entre ellos.
El hash de fuente A67523bf3 sí coincide con la referencia actual: esa evidencia
no se descarta, pero corresponde a otro worker/host/configuración observados.
La traza `compilation-diagnostics-results/partial-4e1e66c1/` es parcial, en WSL;
el diagnóstico 40051899308 solo instrumentó MutationRecord/100, no esta fila.
Los datos previos siguen válidos dentro de su alcance y se conservan íntegros.

La pregunta acotada es qué actividad CPU/GC/JIT se observa durante los segmentos
de Range en copias AA idénticas. El modo instrumentado no explica por sí solo
las diferencias previas ni concede aceptación. V8 no garantiza stacks Rust.

## Secuencia declarada antes de capturar

- Paquetes de la preparación inmutable de collapse, sin reconstruir/instalar:
  J0/J1 y A0/A1; B se autentica como parte del tar, pero no se carga en AA.
- Node22.12.0 y luego Node24.14.1, autenticados por versión/hash.
- Por Node, modo CPU/GC y luego JIT/GC, ambos con fase AA, jsdom/Rustdom,
  labels A/B y las 16 posiciones originales. Una fila: range-control-1000/1000.
- Orden adyacente A/B del plan de collapse, conservando sus inversiones.
  Son 64 procesos por Node/modo; 128 por Node y 256 en total.
- Cada proceso mantiene 3 warmup +9 medidas, warmup de realm original,
  seeds1..16, flags, afinidad y operaciones públicas originales. No se eligen
  posiciones favorables ni se completa una captura parcial.
- Se esperan 768 warmup/2304 medidas/3072 Window y3072 Document separados,
  tres rondas y512 estados finales claros,128 perfiles CPU/128 logs JIT y tres
  snapshots del padre. Son cantidades planificadas, todavía no observadas.
- Inspector:100µs; modo JIT y relojes conservan los parámetros revisados del
  diagnóstico nativo anterior. Se conservan deltas CPU negativos, incertidumbre
  de reloj, primeros estados no claros, controles y todos los spans.
- Límite180000ms por worker, presupuesto55min de captura, step65min/job90min,
  archivo15min/subida10min. No iniciar otro worker si no queda su límite completo.

## Preparación y estado actual

Se reutiliza el productor actual autenticado de native-mutation-telemetry;
se conserva su recibo/protocolo/entrypoint anterior como referencia sin ejecutar.
La única adaptación ejecutable es el binding de configuración de la fábrica
existente: revisión y fingerprints de los paquetes publicados. El sampler
instrumentado y el wrapper de profiling mantienen sus bytes revisados.
El reporte mantiene fuentes, Git y fechas reales; no normalizar errores o HEAD.

`prepare.py` produce un árbol nuevo/disjunto con mapas completos. Los 563 pins
históricos y las 434 fuentes permanecen intactos. `sampler-entry.cjs --inspect`
expone la configuración real sin cargar paquetes DOM ni ejecutar el sampler.
El wrapper de profiling rechaza `captureImplemented=false` antes de observar.

El colector y replay están implementados en módulos separados de contexto,
mapas derivados, observaciones, comandos y readiness. Registran argv/root
originales, fuentes reales, todas las páginas de historial/checks y un recibo
exclusivo por run/attempt. El check más reciente debe aprobar; un éxito anterior
no oculta un fallo posterior. Un fallo conserva el prefijo y nunca lo completa.
El replay completo rechaza parciales; los análisis por proceso y crudos ya
persistidos permiten analizar lo disponible, sin interpretar ausencias como cero.

Los workflows de ejecución/contratos ya están declarados con los límites
anteriores. El transporte existe antes de preparar y conserva incluso un
fallo de readiness. Su índice guarda APIs completas antes de comprobarlas.
Los contratos extraen solo datos históricos y los paquetes exactos publicados;
no ejecutan workers DOM. El subconjunto de regresión incluye ocho procesos
de MutationRecord con bytes originales y el índice completo sin relabelar.
No es captura nueva ni replay positivo de Range.

Faltan revisión/CI íntegros y registro final de mapas con capacidad habilitada.
Los mapas de esta etapa no autorizan captura.
Ninguna etiqueta se aplica ni se permite captura con este estado deshabilitado.
Al completar estos componentes se exige revisión íntegra y CI del SHA exacto,
registrar una única activación y no relanzar, ampliar o cambiar la secuencia.

performanceAccepted=null y gateReevaluated=false siempre. El estudio anterior
continúa rechazado; no se repite ni se acepta por este diagnóstico. No tag/merge
de ownership hasta aceptación de rendimiento íntegra e integración del gate.
