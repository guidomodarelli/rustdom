# Método prospectivo: semillas de arranque por posición

El ensayo pre-GC publicado en343efdc8 terminó íntegro y rechazado: cuatro
controles jsdom en Node22 y siete en Node24 exceden±2%. Los puntos Rust quedan
dentro de sus límites numéricos, pero no permiten aceptar un conjunto sin
calibración. Los datos anteriores permanecen rechazados e inmutables.

Este método controla una fuente adicional de variación de arranque. Node
declara random-seed=0 y hash-seed=0 como valores aleatorios por defecto. Se
fijan las semillas1..16, en ese orden, una por posición. A/B y ambos motores
usan la misma semilla de cada posición; todas las posiciones, fases y versiones
se conservan. No se selecciona una semilla por los tiempos que produce.

Los flags son `--expose-gc --random-seed=N --hash-seed=N`. No se desactiva el
JIT, compilación concurrente, GC concurrente ni tareas de fondo; tampoco se
activa predictable. La documentación del propio V8 advierte que hash-seed no
puede sustituir un seed ya incorporado en un snapshot. El método no afirma
controlar ese estado, direcciones, scheduler, crypto, Date o toda aleatoriedad.
No demuestra que las semillas causaran los rechazos históricos.

Cada worker registra los flags efectivos, semilla y tres primeras lecturas de
Math.random antes de cargar el paquete. Esas lecturas quedan fuera del reloj;
se exige el mismo prefijo entre los cuatro procesos de cada posición, sin
imponer igualdad entre versiones distintas de V8. Son un control de aplicación
de random-seed, no una prueba de control total del hash o del compilador.

Se conserva exactamente el sampler anterior: un JSDOM nuevo por muestra, los
ocho workloads y entradas, operaciones públicas, warmups exteriores3, muestras9,
tres warmups en la ventana actual y las mismas tres colecciones forzadas antes
de calentar. GC natural sigue permitido. Se mantiene afinidad del hilo principal
CPU2; no se cambia la afinidad de los hilos de fondo. Cada proceso carga una
sola copia física y termina antes de iniciar el siguiente.

Por Node:128 workers,1024 lotes,9216 duraciones; dos Node suman256 workers y
18432 duraciones. Mismos16 conjuntos de factores, pooled-median y presupuestos:
jsdom AA/AB±2%, Rust AA±5% y Rust AB+5%. No se omiten filas ni se modifica el
estimador. Un rechazo no se reintenta con otra semilla, subset o extensión de
muestras. Se conservan todos los crudos, negativos y fallos de integridad.

La validación previa debe ejercer las cinco copias oficiales, comprobar los
ocho hashes públicos, liberación independiente de Window/Document y baselines
Rust, prefijos RNG coincidentes y rechazo de flags o semilla ausentes/alterados.
También debe ejecutar workers default sin semillas y verificar los archivos
históricos sin relabel. Los tiempos de calificación no aceptan presupuestos.

Antes de medir: calificación real Node22.12.0/24.14.1, revisión final, commit,
push y autenticación de fuentes del método y recibo de revisión. El driver usa
una raíz nueva y marcador exclusivo; archiva ambos Node y solo acepta el conjunto
completo. No ejecutar otras tareas intensivas ni modificar fuentes medidas
mientras esa secuencia exista. Consultar procesos y handles reales; silencio
no autoriza reinicio. La captura de optimización anterior no se repite.

Esta es una comparación de entropía controlada, con el JIT normal y los límites
declarados; no certifica todos los seeds o máquinas ni sustituye el ensayo de
suites completas default ya conservado. Tampoco acepta retrospectivamente los
métodos anteriores ni cambia código Rust, alcance de migración o compatibilidad.
