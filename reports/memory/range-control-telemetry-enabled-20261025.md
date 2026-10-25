# Recursos del método AA habilitado

La habilitación cambia la configuración y las pruebas de contexto; conserva el
sampler, wrapper de observación y límites publicados. Los contratos del colector
ejercitan lectura real de Git y eventos en procesos hijos, con temporales propios,
sin llamar APIs ni run(). El contexto positivo no inicia ningún profiler o DOM.
Los casos inválidos rechazan host/intento/repo/workflow/run/commit/evento.

Los contratos del worker real prueban host ajeno, intento repetido y run/commit
ausentes en ambos Node/modos. Cada rechazo precede a observadores y conserva la
ausencia del reporte, sidecar y fuente. Los archivos y temporales propios se
cierran y limpian; la fixture Git sigue restaurándose en finally.

No se generaron observaciones nuevas de Window/Document en esta QA. Su teardown
end-to-end, baselines nativos, rondas finales y snapshots del padre se comprobarán
con la única captura cuando el método publicado tenga revisión y CI del SHA exacto.
No se mide memoria pico ni se garantiza ausencia universal de fugas. Los estudios
históricos mantienen sus resultados y rechazos; este diagnóstico siempre produce
performanceAccepted=null/gateReevaluated=false.
