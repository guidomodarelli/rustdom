# Recursos del candidato combinado — 2026-10-25

Evidencia finita de Linux/WSL con Node22.12.0 y24.14.1 y el mismo ELFce91c742.
No es memoria pico ni una garantía universal de ausencia de fugas. No acepta
rendimiento: `performanceAccepted=null`, `gateReevaluated=false`.

Por SDK se ejecutaron dos probes separados, seis ciclos cada uno, con controles
retenidos deliberadamente antes de soltar las referencias. Window y Document
se observan por separado; los snapshots/trace y todos los contadores originales
permanecen en los cuatro JSON de este directorio y el ZIP QA completo.

| Probe, por SDK | Window | Document | NativeRange creados/liberados | Live final |
| --- | ---: | ---: | ---: | ---: |
| Construcción StaticRange, inválidos, cierre y liberación | 6 | 6 | 774/774 | 0 |
| Clones, colapso, mutaciones, cierre y liberación | 6 | 6 | 384/384 | 0 |

StaticRange conserva768rechazos de nodos inválidos por SDK; no crean NativeRange.
Cada probe comprueba que el objeto retenido impide la quiescencia esperada y que,
al soltarlo, llegan a cero los survivors de Window/Document/ranges/native que
observa su contrato. Los22constructores N-API existen antes del baseline y
permanecen22 al final, sin cleanupErrors. No atribuir estas referencias del
módulo a una fuga de cada Window. Las tablas no son asignaciones solo del timer.

El nuevo controlador Rust conserva únicamente endpoints numéricos al retornar.
Los helpers y Unknown de host son scoped; los getters/callbacks se ejecutan sin
préstamos activos de TreeStore. El binding conserva las aristas DOM visibles a V8.
El colapso no mueve owners iguales y preserva la ruta anterior para owners distintos.
Los controles y pruebas públicas ejercen snapshots independientes, errores,
reentrancia, raíces desconectadas y mutaciones posteriores al colapso.

Los probes de ambos SDKs se ejecutaron en procesos separados parcialmente
simultáneos, con el mismo binario, antes de las suites completas. No se deriva
una comparación de RSS entre versiones ni un máximo simultáneo del proceso padre.
Se preservan memoria JS/externa/RSS por endpoint y límites de rondas/timeout
originales; ninguna falla fue ocultada cambiando presupuestos. El corpus de
memoria de las suites completas también queda íntegro en QA, sin sumarlo como
si fueran escenarios independientes de los dirigidos que ya lo ejercen.

El objetivo de memoria sigue requiriendo nuevos escenarios con cada cambio.
Windows/macOS de este candidato, cargas largas y contextos no cubiertos quedan
pendientes. Ver [validación y límites](../../../validation/range-combined-candidate/20261025/README.md).
No se altera la evidencia histórica ni se repite una captura de rendimiento.
