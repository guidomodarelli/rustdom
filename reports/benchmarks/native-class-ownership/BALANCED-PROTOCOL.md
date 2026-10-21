# Diagnóstico A/A de carga y asignación de módulos

Se fija antes de medir. El método emparejado original terminó completo y sin
aceptación. Al recalcular sus medianas por proceso, jsdom A/A con 250 filas
tiene B más lento en siete de ocho procesos pese a usar paquetes idénticos.
La carga A primero y las copias físicas fijas son condiciones no balanceadas;
esa observación no demuestra causalidad ni permite corregir los datos previos.

## Pregunta y alcance

¿El contrabalanceo de esas condiciones y un probe simétrico producen una
calibración A/A utilizable para esta operación pública de realms nuevos?
Este diagnóstico **no mide el candidato B** y **nunca acepta su rendimiento**.
Aunque calibre, será necesaria evidencia A/B propia y revisión antes de cambiar
el estado del presupuesto. Los estudios y gates anteriores permanecen intactos.

Se conservan las funciones reales `sample` y `cleanup` de `paired-worker.cjs`,
el HTML, tamaños 250/1.000, DOM nuevo por muestra, 1.000 operaciones públicas,
tres warmups, nueve muestras por etiqueta/tamaño y tres rondas de limpieza con
los últimos dos endpoints claros. No se cambian flags JIT ni umbrales.

## Diseño fijado

Node 22.12.0, Linux/WSL, CPU 2, sin NODE_OPTIONS ni cargas locales simultáneas.
Ocho procesos por motor: las tres decisiones binarias forman las ocho celdas
de un factorial completo, sin confundir carga, asignación y orden de muestras:

- Bit 0 del índice: carga A/B o B/A.
- Bit 1: asignación A0/A1 o A1/A0; para jsdom J0/J1 o J1/J0.
- Bit 2: orden de muestras original o invertido; también invierte tamaños.

Cada celda aparece exactamente una vez por motor. Se alterna el motor que se
ejecuta primero. El probe prepara un DOM, crea un Range, consulta su texto y
cierra el DOM en **ambas** etiquetas. Comprueba asignaciones propias y ausencia
de asignaciones en el otro addon en ambos sentidos; su orden sigue la carga.

Son 16 procesos, 576 duraciones medidas, 768 observaciones incluyendo warmups
y 768.000 copias públicas. No hay A/B automático, ampliación de muestras ni
reintento por un resultado desfavorable. Se preservan errores y observaciones
parciales. Código, paquetes, contadores y salidas se verifican; las nueve
fuentes del método se archivan antes de medir y permanecen congeladas.

La calibración exige ±2% jsdom y ±5% Rust en ambos tamaños, usando todas las
muestras y las medianas originales. Una calibración fallida devuelve exit 1;
`accepted=false` es incondicional porque este diagnóstico es únicamente A/A.
No se infiere causa del ruido a partir de una calibración agregada: cada celda
tiene un solo proceso y los factores de interacción requieren otro estudio.

## Validación previa

Los contratos ejercen paquetes físicos y addons reales, las ocho asignaciones,
el probe simétrico, ejecuciones completas de ambos motores y ambas direcciones,
checksums originales, contadores y liberación de Window/Document en Node 22 y
24. La revisión debe terminar antes de la primera medición. Los resultados y
límites se publicarán incluso si no calibra. No se ejecuta una nueva matriz de
producto: no se modifica producción y se conserva su evidencia anterior.
