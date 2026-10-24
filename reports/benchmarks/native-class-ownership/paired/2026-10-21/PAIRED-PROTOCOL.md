# Comparación emparejada con realms nuevos

Se declara antes de medir. La corrida independiente anterior completó sus
1.152 duraciones pero no calibró ninguna fila; el control jsdom A/B varió
+213,42%/−24,81%. Los perfiles mostraron compilación de fondo en 69 de 72
muestras. Nada de eso demuestra causalidad del parche.

La inspección de `benchmarks/worker.cjs` confirma que cada warmup y muestra
crea otro JSDOM y prepara otros wrappers. La hipótesis nueva es que emparejar
etiquetas dentro del mismo proceso reduce variación entre procesos y su estado
de V8, conservando **realms nuevos en cada muestra**. No se reutiliza el DOM ni
se mueve trabajo de la operación pública fuera del cronómetro.

## Diseño fijado

Node 22.12.0, Linux/WSL, CPU 2 y los mismos binarios inmutables A/checkpoint 67
y B/guard de ownership. No se cambian JIT, flags de V8, política de energía ni
GC automática. Las fuentes, binarios, módulos copiados y herramientas quedan
registrados antes/después; el host Windows sigue fuera del control de afinidad.
No ejecutar builds, tests ni otras mediciones locales simultáneas.

Una sola secuencia A/A y después A/B. Cada fase usa ocho procesos por motor,
alternando jsdom/Rust y Rust/jsdom según el índice del par. Cada proceso carga
dos paquetes independientes antes de medir. A/A Rust utiliza dos copias físicas
idénticas de la distribución A; A/B utiliza A y B. jsdom usa dos copias físicas
del mismo jsdom 27.4.0 en ambas fases. Dependencias externas son comunes y se
documenta ese contexto compartido. Se comprueba que las clases/prototipos y,
en Rust, los contadores de asignaciones sean independientes.

Cada proceso conserva tamaños 250/1.000 y, por tamaño/etiqueta, tres warmups y
nueve muestras. Los pares alternan AB/BA según `constants/paired.cjs`; los
procesos impares invierten el orden. Son 32 procesos, 1.152 duraciones medidas,
72 por fase/motor/etiqueta/tamaño y 1.536.000 copias incluyendo warmups. El orden
de tamaños también se invierte en procesos impares.

El HTML, preparación de un Range por fila y cuerpo cronometrado son los mismos:
1.000 `cloneRange`, `collapse` alternado y `compareBoundaryPoints` consumidos.
El DOM se crea de nuevo para cada etiqueta/muestra. Se comprueban checksum 500,
identidades/endpoints originales, todas las filas y hash completo de salida,
incluida coincidencia con los reportes originales. El contador nativo prueba
1.000 asignaciones de copia reales por muestra Rust.

Fuera del cronómetro se cierra cada ventana y se reutiliza `collectGarbage`
de `scripts/memory-endpoint.cjs`: tres rondas fijas, cada una con dos ciclos
turno/GC major asíncrona más un turno final, en ambos motores/etiquetas, para observar
finalizadores antes del otro tratamiento. Se conservan contadores y WeakRefs
de Window/Document por separado; no se prolonga la limpieza hasta aprobar.
Se registra memoria posterior, sin confundirla con memoria pico o prueba
universal de ausencia de fugas.

Revisión previa a la primera medición: los contratos funcionales encontraron
retención después de una ronda en jsdom, A y B. El diagnóstico acotado del helper
canónico observó liberación en la segunda y dos muestras claras al completar la
tercera, con 1.250 rangos asignados/liberados en ambos Rust. Por eso se fijan
tres rondas iguales, con traza completa y dos endpoints claros; no se decide
su número durante la medición ni se cambian tiempos o umbrales según resultados.

## Interpretación

A/A exige ±2% para jsdom y ±5% para Rust en ambos tamaños. A/B exige control
jsdom ±2% y Rust como máximo +5%. Las medianas incluyen todas las muestras;
se conservan también medianas por proceso y diferencias emparejadas. A/B se
completa aunque A/A no calibre, pero no puede aprobarse sin calibración.
No se filtran muestras, relajan umbrales ni repite una corrida completa según
su resultado. Los casos con error preservan sus observaciones parciales.

Este diseño cambia el contexto de muestreo: dos implementaciones coexisten en
un isolate y comparten dependencias externas; no equivale a dos procesos
independientes. Su aceptación, si ocurre, solo vale para este protocolo. Los
resultados originales y el gate anterior siguen publicados y no se convierten
retroactivamente en aprobados. La evidencia nueva debe revisarse antes de
decidir qué demuestra sobre el presupuesto y el cierre del hito.
