# Una copia de paquete por proceso

Estado: hipótesis nueva en validación; no es evidencia de aceptación.
El estudio hosted `39721610003` terminó y permanece rechazado. No se repite.

## Hipótesis y límites

Cargar dos copias del mismo motor en un isolate puede introducir interacción
entre sus módulos, dependencias y optimización V8. Este método elimina esa
coexistencia: cada worker carga exactamente una distribución física. No supone
que eso explique la dispersión observada ni garantiza calibración. Los procesos
se ejecutan secuencialmente y tienen V8, heap y registros nativos independientes.
No hay prueba simétrica entre dos runtimes dentro de un worker porque esa carga
reintroduciría precisamente la exposición que se está retirando.

Se fijan los mismos paquetes oficiales del run `39720077911`, artefacto
`12400802735`, con su recibo íntegro de preparación; no se reconstruyen.
La prueba de caché de módulos cuenta las cinco distribuciones físicas y exige
únicamente la seleccionada, antes y después de los lotes. Las dependencias
compartidas en disco se cargan en procesos separados; no se comparte heap.
Esto no elimina el runtime JavaScript híbrido del producto.

## Diseño fijado

Node 22.12.0 y luego 24.14.1; A/A y luego A/B en cada Node. Se conservan las
ocho cargas públicas, tres warmups y nueve muestras por lote. CPU2 se aplica
solo al hilo principal y se registran también las máscaras de fondo.

Hay ocho posiciones por fase y motor. El bit 0 invierte el orden de ejecución
de los procesos A/B adyacentes; el bit 1 intercambia A0/A1 o J0/J1; el bit 2
invierte el orden de las ocho cargas dentro de cada proceso. En A/B Rustdom,
B siempre es C. Cada posición ejecuta los dos motores en el orden alternante
previo. Son 64 workers por Node, 128 en total y 9.216 duraciones: se divide
la carga previa de cada worker entre dos procesos, sin aumentar muestras.
El nuevo orden de filas y la ausencia de la prueba de coexistencia también
son cambios del método; no se atribuirá causalidad individual al resultado.

Se reutiliza la razón de medianas agrupadas del estudio anterior. Los procesos
son las unidades independientes; las nueve muestras internas no cuentan como
nueve procesos. Los límites siguen siendo ±2% jsdom, ±5% Rustdom A/A y +5%
Rustdom A/B, en todas las filas y ambos Node. Los dos procesos de cada posición
se agrupan únicamente para reutilizar el cálculo, sin inventar un worker común.
Todos los reportes conservan PID, tratamiento y fuentes de cada proceso real.

La limpieza conserva tres rondas y exige los últimos dos endpoints claros,
con Window y Document separados y baseline nativo. Las referencias de warmup
y medición se acumulan dentro del worker. Memoria posterior a GC no es pico
ni demuestra ausencia universal de fugas.

## Condiciones antes de medir

Se requieren pruebas reales en ambos Node: workers para A0, A1, C y jsdom,
outputs públicos equivalentes, liberación y rechazo de paquetes alterados.
El driver debe preservar errores e incompletos, autenticar preparación y arnés,
recalcular la decisión offline y rechazar archivos anteriores como este método.
Se publicarán las fuentes y su revisión antes del ensayo completo único.
Las ejecuciones de contrato del sampler no aceptan presupuestos y se conservan
por separado; sus tiempos no se incorporan al ensayo.

Exit 1 por presupuesto con archivo completo permite avanzar al otro Node;
exit 2 por ejecución/integridad detiene la secuencia. No hay reintentos,
selección de muestras ni relajación de límites. Un método sin calibración
no cierra ownership. El workflow `ownership-single-package.yml` se activa
únicamente con la etiqueta nueva `ownership-single-package-v1` en el PR, una
sola vez, después de publicar y verificar el recibo de revisión del arnés.
No usa synchronize ni recompila paquetes; intentos superiores a uno se omiten.
El run conserva el SHA publicado y todos los datos, incluso si falla.
