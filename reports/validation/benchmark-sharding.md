# CI: particiones completas de benchmarks

El run 34920235517 del PR64 falló porque el segundo worker llegó a su límite de
600.000 ms al comenzar range-clone-contents/1000. El diagnóstico conservó progreso
y muestras previas; no fue un fallo de los contratos de Storage.

El plan canónico se extrae a un módulo compartido y se reparte por índice entre
cuatro jobs independientes. Los tests verifican que sus 189 cargas predeterminadas
aparecen exactamente una vez: 48, 47, 47 y 47. Se conservan los casos manuales
opt-in, las muestras por operación y el límite por worker. El reporte identifica
la partición; complete significa completa para esa partición.

El check `benchmarks` conserva su nombre y solo pasa si todos los jobs terminaron
correctamente. Cada partición guarda un artifact distinto, incluso ante fallos.

[Los 14 tests](benchmark-sharding/tests.log) pasaron sobre el binario publicado
del PR64, incluido un benchmark real de una partición y otro sin particionar.
[La cobertura del plan](benchmark-sharding/coverage.json) queda registrada.
Las muestras producidas por esos tests son validación del arnés, no una afirmación
de rendimiento de producto. El CI remoto verificará las cuatro particiones completas.

Actionlint 1.7.12 aprobó el workflow con sus validaciones de sintaxis y expresiones
(`-shellcheck=`; no se ejecutó el checker externo de shell). Se conserva el log
de salida vacío y el exit code exitoso de la ejecución.
