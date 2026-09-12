# Capacidad retenida de los índices de atributos

El hallazgo del PR #8 se reprodujo antes del fix con seis regresiones Rust. Un elemento que había recibido 4096 atributos conservaba capacidad para 4096 entradas ordenadas y alrededor de 7168 entradas por tabla aunque solo quedaran ocho atributos. También retenían el pico los buckets de nombres, los sets de holders y los enlaces de propietario iniciales.

El cambio compacta cada contenedor según su propia ocupación. Las colecciones grandes se reducen al quedar como máximo un cuarto ocupado, conservando espacio para el doble de entradas vivas y un mínimo reutilizable. Los contenedores de hasta 64 entradas de capacidad no se compactan en cada mutación. Esto evita una realocación por cada alta/baja pequeña. Las tablas globales siguen liberándose completamente al finalizar su último nodo.

La revisión también detectó que `HashMap::capacity()` puede excluir los slots con tombstones sin liberar sus buckets. Un probe separado con colisiones totales observó una caída de capacidad declarada de 7168 a cero u ocho mientras seguían asignados 139.280 bytes netos por tabla; una reinserción volvía a exponer capacidad 7168. El almacenamiento privado conserva por ello la capacidad máxima observada antes de las mutaciones, y reconstruye la tabla cuando se activa la compactación. No cambia el hasher original y no conserva sus claves eliminadas. El coste adicional es un `usize` por mapa o set; los vectores no necesitan ese dato.

La lista ordenada, los aliases de nombres y las referencias se tratan de forma independiente. Una lista ordenada vacía puede conservar un alias válido a un Attr que pertenece a otro elemento; compactar no borra esa relación ni su identidad.

Los tests Rust observan la capacidad asignada de las estructuras reales, sin nuevos exports de producción. En los escenarios ejecutados, los vectores bajaron de 4096 a 64 entradas de capacidad, las tablas de 7168 a 56, y un set compartido de 3584 a 56. Los datos del baseline y la salida completa de los tests están junto a este documento.

El script `node scripts/attribute-capacity-memory.cjs` complementa esas pruebas con cinco ráfagas de 2048 atributos de 1 KiB en un documento y elemento vivos, comparando rustdom con jsdom independiente. Comprueba los Attr temporales mediante WeakRef antes de cerrar la ventana y observa Document y Window por separado después del cierre. Sus resultados se guardan en JSON con fecha.

La ejecución del addon reforzado con tres warmups completos pasó en ambos motores: se recolectaron los 10.240 Attr temporales observados en cada motor antes del cierre, y después se recolectaron Document, Window y el Attr conservado por el alias. En rustdom el heap usado creció 157.016 bytes y el RSS 1.490.944 bytes entre baseline y última muestra, con los contadores nativos de nodos y relaciones estables. Su reporte es `2026-09-12T02-36-25.657Z-attribute-capacity.json`, con hash del addon `362cfe5c52d0b989eaa4e87006e470211fc1a52547594416741e58b356cd627f`.

Se conserva además una ejecución anterior con un warmup menor, de 256 atributos: el RSS de rustdom creció 24.932.352 bytes al alcanzar el tamaño medido y se estabilizó en sus últimas muestras. Ese resultado motivó igualar el tamaño de calentamiento al de las mediciones; no se descartó el reporte. La devolución de capacidad se prueba directamente en Rust, y ambas ejecuciones comprobaron la recolección de los objetos observados.

El benchmark `node benchmarks/attribute-capacity.cjs <addon-base> <addon-candidato>` mide inserción, eliminación y el ciclo completo de atributos a través del addon real en procesos nuevos y orden alternado. Incluye el coste de recrecer las tablas después de compactarlas y registra todas las muestras. Es un microbenchmark de la API nativa: no demuestra una mejora de tiempo total de Jest o Vitest.

Las capacidades están expresadas en entradas, no en bytes RSS. La devolución de un buffer Rust no obliga al allocator a devolver inmediatamente sus páginas al sistema operativo. Las pruebas finitas cubren los escenarios descritos; no constituyen una demostración de ausencia absoluta de fugas.

Seguimiento separado: `TreeStore` todavía decide la compactación de sus tablas `nodes`/`data` a partir de `capacity()`. Esta revisión no reprodujo retención oculta usando los patrones reales de handles de ese núcleo, ni modifica esas tablas. Se registra para una verificación específica: un `capacity()` bajo por sí solo no demuestra que los buckets hayan sido liberados.
