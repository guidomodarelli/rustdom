# Evidencia de colector y replay deshabilitados

qa.zip contiene5436miembros y conserva las primeras tres baterías, comandos, preflights,
planes, derivaciones CPU/JIT, manifests y snapshots de fuente. members.json
enumera cada hash/tamaño. ZIP SHA256d00ff4d41afffc47c21a0622a8aba451be4c58ae6733f49f91cdb3ed5792c339.
No ejecutar código de ese archivo; usar siempre productores/lectores actuales.
qa-final.zip conserva1813miembros de la cuarta batería, con hash
818da320c4b4a574138b09c8c0eb2ff99709ad4a1daa898e9fed3b0a4a6313b4.
summary.json fija el estado final y ambos archivos; preliminary-summary.json
conserva el resumen anterior sin reescribir su contexto.

Base publicada254d0e9f. Snapshots locales reales d2ca3af2,87276569,d2d332a9 y955f3beb;
el último es el validado final. Son commits privados de QA sobre un Git Linux
real, con sources/errores observados, no identidades normalizadas del HEAD
publicado. La fixture Git propia se modificó/restauró para comprobar los
espacios de porcelain. Se conservan la corrección de sparse y la configuración
local de autor desde los valores existentes de Windows, sin exponerlos aquí.

Resultado final:17contratos por Node22.12.0/24.14.1 y seis de preparación Python.
Planes/preflights byteidénticos, grafo590,563pins históricos y893archivos por
derivación. Las baterías16/16/17 anteriores se conservan; no se suman como
cobertura nueva. Se añadió el recibo histórico al grafo, se exigió run vivo
y se reforzó la identidad de paquetes; después se probó el budget completo.
La última centralizó rutas/etapas sin cambiar sus valores y volvió a comprobar
los mapas y contratos. Las modificaciones posteriores de README son documentación,
fuera del grafo ejecutable probado de590archivos.

Los ocho procesos nativos históricos se leyeron del transporte autenticado
40051899308, con índice SHA88a805f5 y todos sus archivos comprobados antes
del lector. Conservan96spans por lector, incluidos warmup, clocks inciertos
y deltas originales. No se copian ni transforman como observaciones de Range.
summary.json identifica selección y alcance; el archivo original sigue íntegro.

No se ejecutaron DOM, sampler, Inspector o profiling nuevos. No hay un replay
positivo de una captura nueva: captureImplemented=false. Quedan workflows y
revisión/CI íntegros antes de habilitarla. performanceAccepted=null y
gateReevaluated=false; el rechazo de ownership permanece intacto.
