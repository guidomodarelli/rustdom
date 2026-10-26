# Orden de motores independiente del orden de tratamientos

Estado: método en validación, sin ensayo completo nuevo. El resultado anterior
39727878290 permanece completo y rechazado; no se repite ni se reinterpretan
sus límites o muestras.

## Pregunta y fundamento

El schedule anterior usa el mismo bit para elegir qué motor ejecuta primero
y qué tratamiento del par ejecuta primero. Su archivo order-factors.json muestra
solo dos de las cuatro combinaciones posibles por motor. Este contraste hace
independientes esas decisiones y conserva un paquete por proceso. No se ha
demostrado que la restricción anterior cause el drift ni que este cambio lo
resuelva. También aumenta la replicación independiente; no se atribuirá el
resultado exclusivamente a un factor de orden.

## Entradas y diseño fijados antes de medir

Se reutiliza la preparación oficial 39720077911, artefacto 12400802735, ZIP
SHA-256 b25f1e98608c6abb50cb9a5c9feb00f825276941511f3ed9905c457480582610,
tar SHA-256 c1b65afaaaeb48f4463cd276b8edf73fe783a68b7c39d1f61cb43ab8d396b839.
UUID 99fb5dd8-2ee8-402c-97b4-d8174069f933. No se reconstruyen ni se reemplazan
paquetes por los de un run posterior. Se autentica toda la preparación antes
y después de cada Node, con sus fuentes y dependencias completas.

Node 22.12.0 y después 24.14.1; A/A y después A/B por Node. Las mismas ocho
cargas públicas y sus fixtures originales, tres warmups y nueve muestras por
lote. Una distribución por proceso. CPU2 se aplica solo al hilo principal;
las máscaras iniciales/configuradas/finales de los hilos se conservan.

Las dieciséis posiciones son el producto completo de cuatro bits:

| Bit | Decisión |
| --- | --- |
| 0 | Orden A/B de procesos adyacentes del mismo motor |
| 1 | Asignación física A0/A1 o J0/J1; C permanece B en Rustdom A/B |
| 2 | Orden normal/inverso de las ocho cargas dentro del proceso |
| 3 | Orden jsdom/Rustdom dentro de la posición |

Cada combinación ocurre una vez por fase y motor. Cada combinación del orden
de motor/par ocurre cuatro veces, con ambos valores de los otros factores.
Son 128 procesos por Node, 256 en total y 18.432 duraciones medidas. Las nueve
muestras internas no se convierten en nueve procesos independientes. Las
posiciones 8..15 amplían el diseño completo; no son reintentos seleccionados.

Se parametriza el sampler/archivador existente sin cambiar la implementación
de las cargas o la limpieza. El modo legado de ocho posiciones conserva su
schedule y puede verificar el archivo anterior; ese archivo no se relabela.
La agrupación para el estimador no cambia el orden real registrado de procesos.

## Decisión, recursos y publicación

Se conserva la razón de medianas agrupadas, con dieciséis procesos por
tratamiento/motor/fila y 144 duraciones por celda. Límites: ±2% jsdom, ±5%
Rustdom A/A y +5% Rustdom A/B, todas las filas en ambos Node. Fallar calibración
impide aceptar; no se elimina ningún proceso, muestra o fila ni se cambian
presupuestos. Exit 1 completo permite continuar al siguiente Node; exit 2 por
ejecución/integridad detiene la secuencia y conserva lo parcial.

La limpieza sigue haciendo tres rondas y exige las últimas dos claras, con
Window/Document separados y baselines nativos. Se conservan referencias desde
warmup y todas las observaciones. Heap/external/RSS son estados después de GC,
no picos ni una prueba universal de ausencia de fugas.

Antes del ensayo se requieren contratos reales en ambos Node, verificación
legada positiva, rechazo del archivo anterior por el verificador nuevo y
revisión publicada del arnés completo. Los workers de contrato son validación
funcional del método, sin aceptar presupuestos ni incorporarse al estudio.

Se activa una sola vez con la etiqueta ownership-independent-order-v1 después
de publicar y cotejar la revisión con el commit. El workflow no usa synchronize
ni rerun; intentos superiores a uno se omiten. Su límite de infraestructura es
150 minutos por haber duplicado los procesos; no cambia ningún presupuesto
numérico ni el tiempo medido de las operaciones. No hay reintentos automáticos.
Guardar todos los resultados, incluso otro rechazo. No hay nuevo crédito Rust
ni cierre de ownership antes de una aceptación verificable y CI/review finales.
