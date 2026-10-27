# Medición única del candidato actual de ownership

Los estudios anteriores permanecen consumidos y sin aceptación. No se repiten,
reclasifican ni filtran. El último gate no tiene evidencia correspondiente al
runtime actual: rechaza sus fuentes antes de calcular un presupuesto histórico.

El candidato actual es la implementación real publicada en a5a1379d, fuente
`5ef668c47a78bb73ef5b0881fbf20e6d36c4d4cc9686198c26e722d8fc9c6806`.
Incluye las lecturas nativas de propiedades XML; no se afirma que ese cambio
acelere las cargas de ownership. Su serialización XML tiene evidencia separada
aprobada y no sustituye este presupuesto. El runtime sigue siendo híbrido.

La preparación oficial39906777389/artifact12481226791 está fijada en
`reports/validation/native-class-ownership/current-source-preparation/39906777389/`.
ZIP14971129bytes, SHA256
`8d74c353eca260e14eae3f055fc5fa9303ed7b781064144e51e85f57c10beae6`;
tar14996436bytes, SHA256
`0a44778e3e694a6dcf65fffd1125913e10b9c1ed0bbeabd1d4e6f076e4d648d3`.
UUID`b1412b0b-da1f-4147-9879-c38a821b43da`. La referencia A es checkpoint067,
fuente67523bf3; B es5ef668c4. Se comprueban fuentes, inputs de raíz, dependencias,
las cinco distribuciones completas, herramientas y los dos probes públicos
originales. Cada probe observa15Window y15Document y conserva sus endpoints.
No se reconstruyen paquetes ni se concede rendimiento desde la preparación.

Se reutiliza íntegro el método row-isolation: ocho cargas públicas, AA y AB,
dieciséis posiciones con los cuatro factores existentes, semillas1..16, orden
de motores/etiquetas/copias/cargas sin cambios y una sola carga por proceso.
Node22.12.0 primero, Node24.14.1 después. Son1024procesos y9216duraciones por
Node;2048procesos y18432duraciones en total. Se conservan tres warmups exteriores,
nueve muestras por lote, tres warmups del realm y el orden de GC existentes.
El hilo principal usa CPU2; las máscaras de los otros hilos se registran.
No se desactivan JIT, GC natural ni compilación concurrente.

El estimador conserva144duraciones por celda y su mediana agrupada.
Presupuestos: control jsdom AA/AB±2%, Rust AA±5%, Rust AB+5%. No se amplían
límites, semillas, posiciones, procesos, muestras ni warmup. Una celda sin
calibración no acepta el presupuesto aunque el número Rust esté dentro del
límite. Deben pasar todas las cargas y ambos Node; no se acepta un subconjunto.

La etiqueta nueva y exclusiva es `ownership-current-source-v1`. Solo se lanza
una secuencia, después de QA real de ambos Node, revisión independiente limpia,
publicación y autenticación del arnés y recibo. Los inputs actuales deben
coincidir con el candidato preparado y conservarse antes/después de medir.
La factory existente acepta una preparación explícita; su comportamiento
histórico predeterminado permanece intacto. El nuevo binding no cambia el
algoritmo de scheduling, muestreo, validación de workers ni estimación.

El job completo dispone de180minutos para ambos Node y la conservación del
archivo. Este timeout externo no cambia las muestras ni los límites por worker;
evita truncar la secuencia serial de2048procesos. El historial paginado de runs
no omitidos debe contener solo el run actual antes de cualquier medición;
quitar y reaplicar la etiqueta no concede otra secuencia.

La calificación ejerce las cinco copias reales y las ocho cargas, errores de
input/distribución/probe, flags, identidad Node, comportamiento público,
Window/Document separados y teardown. Los lectores existentes deben seguir
verificando los negativos históricos y rechazar una implementación cambiada.
Los tiempos de calificación no se usan para decidir rendimiento ni seleccionar
datos. No iniciar el ensayo hasta publicar esa evidencia.

Se guardan todos los índices, fuentes de arnés, entradas, salidas, errores,
duraciones, warmups, versiones, hardware y endpoints. Se conservan también los
parciales si falla una ejecución. El fallo de presupuesto en Node22 no impide
conservar la secuencia declarada de Node24; un error de integridad sí detiene el
ensayo sin repetirlo. `accepted:null` o incompleto nunca se transforma en éxito.
Un resultado negativo no autoriza relanzar, repetir, extender ni cambiar el
protocolo para este candidato. No hay tag ni merge antes de aceptación real.

Los endpoints comprueban liberación finita antes de salir; la terminación del
worker no sustituye esa comprobación. RSS/heap son snapshots, no memoria pico
ni prueba universal de ausencia de fugas. Toda conclusión debe conservar esos
límites y distinguir el presupuesto de ownership de la evidencia XML.
