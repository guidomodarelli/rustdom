# DOMImplementation: migración en validación

Rama feature/native-dom-implementation sobre main 9f9970297dd28a87500b7faaac1bbe495798728e, checkpoint-056-selection. La validación local completa y los paquetes están aprobados. La publicación requiere todavía su propio PR, checks y revisión.

## Responsabilidades

document_implementation.rs decide MIME por namespace exacto y valida QName mediante valid_xml_name, reutilizando xmlparser y preservando UTF-16. document_implementation_binding.rs controla hasFeature, createDocumentType, createDocument y createHTMLDocument dentro de scopes N-API. No almacena referencias JavaScript persistentes. El adapter document-implementation.cjs conserva los owners visibles a V8 y conecta las factories reales, llamadas de mutación, errores del realm y asignación estricta de origin.

Se mantienen las factories Document/DocumentType/Element y validateAndExtract del host para creación de elementos namespaced. No se presenta este cambio como migración completa de esas dependencias ni de DOMParser. Las llamadas de append usan puentes separados para conservar los diagnósticos de las expresiones originales. Las operaciones y sus contadores se exponen en native y en getNativeTreeStatistics.

## Evidencia focal

Los primeros casos detectaron un defecto de la implementación nueva: into_utf16 incluye el terminador de N-API. Se corrigió usando la longitud real, sin eliminar NUL del contenido. qname-terminator-before.log y la matriz original conservan el fallo; missing-trait-build.log conserva el import de trait que faltó en la compilación inicial.

Pasaron 144 casos públicos de estructura, MIME, QName, title, origin, adopción y precedencia, más 16 casos de efectos/reentrada por versión de Node 22.12/24.20. Se mantienen identidades de excepciones objeto/símbolo, efectos anteriores al error, getters de globalObject y préstamos de métodos entre realms.

Cinco WPT sin modificar, fijados al revision 8d124dbe46f46f55531f28f13eccf1113f794c12, pasaron 635/635 resultados: hasFeature, createDocumentType, createDocument, createHTMLDocument e implementación guardada tras retirar un iframe. Dos fixtures upstream sin testharness se ejecutan por separado como contratos de regresión: conservan el HTML y verifican ausencia de excepciones, eliminación del iframe y disponibilidad del documento guardado.

GC ejecutó warmup y tres ciclos de 100 documentos por motor y realm, en Node22/24. Después de soltar owners se comprueban Document/Window por separado, implementaciones, doctypes, errores y retorno a los contadores nativos de baseline. Los reportes guardan heap, externa y RSS; son observaciones finitas, no una prueba universal de ausencia de fugas.

## Rendimiento y atribución

El harness mide 100/1000 operaciones públicas, dos procesos por motor, warmup y 18 muestras por fila. Conserva resultados durante timing y valida estructura, identidad y activación nativa fuera del intervalo. Se midieron la candidata, jsdom y el rustdom anterior con el mismo harness y el binario histórico identificado por hash. La ruta histórica declara package-override y carece del contador del controlador nuevo.

Los resultados frente a jsdom favorecen la creación HTML/XML grande, pero la comparación con rustdom anterior muestra que esa ventaja ya estaba presente. La migración agrega costo, especialmente en doctype y QName inválido. Se conservan las tres mediciones completas; no se atribuyen al nuevo controlador mejoras de módulos previos ni se presenta como una aceleración universal.

## Validación final del hito

La fuente compilada se identificó con SHA-256 c14b922123816344b3dc3a65ba1b3d642eb3dc9e9cf7f6d0ae3479896f2dc7a7. El addon es 9dea1692377991645dffc6b7f78a159ce7d6ebca28ee4b7f3532691e535ee671. source-copy.json verifica los mismos archivos entre el checkout principal y /home/guido/rustdom-document-implementation-oKz06P, ambos sobre main56.

Pasaron formato, Clippy, 255 tests Rust, 2.478 contratos Node, Jest 20, Vitest 31 y VM 30. El corpus HTML conserva 1.784 casos comparables y 8 excluidos. El corpus WPT completo ejecutó 221 fixtures, 82.939 resultados en paridad y 81.739 estándares aprobados; 1.200 fallos son compartidos con jsdom. Los bloqueos/exclusiones previos permanecen explícitos.

El paquete rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-16T02-51-22.713Z.tgz tiene SHA-256 8e7ffad21b7a13d6cdbcccdf7362665164f9a7d119e19fc53893a775c1691a02. El mismo archivo pasó 20 controles por runtime, 40 en total, con Node 22.12/24.20 y npm/pnpm, incluidos consumidores CJS/ESM, tipos, Workers, assets y runners reales. Los reportes de distribución son 2026-09-16T02-51-26.072Z-linux-x64.json y 2026-09-16T02-53-09.516Z-linux-x64.json. El hash de la copia guardada se volvió a verificar.

Los controles de memoria finales están en reports/memory/2026-09-16T02-28-17.258Z-document-implementation.json y 02-28-19.480Z-document-implementation.json. Se copiaron 97 outputs nuevos/modificados con hashes comprobados. El WPT de 60.153.907 bytes quedó archivado sin pérdidas en 865.181 bytes gzip, con roundtrip y hashes en document-implementation/archive-manifest.json. El original permanece en la caché del runtime.

## Costos comparados con el rustdom anterior

Los informes completos son reports/benchmarks/2026-09-16T02-32-58.986Z-linux-x64.json (baseline) y 02-34-09.994Z-linux-x64.json (candidata). Usan el mismo hash de harness; runtimeSource y nativeBinarySha256 distinguen el motor cargado. La primera medición 02-29-28.411Z también se conserva.

| Operación, 1.000 elementos | Baseline rustdom (ms) | Candidata (ms) | Cambio bruto | Cambio del control jsdom |
| --- | ---: | ---: | ---: | ---: |
| HTML |207,503|218,699|+5,4%|+6,8%|
| XML |128,900|135,174|+4,9%|+3,7%|
| Doctype |2,339|3,427|+46,5%|+6,4%|
| QName inválido |14,116|19,361|+37,2%|+9,4%|

reports/benchmarks/document-implementation/comparison.json conserva rangos, controles y cocientes de medianas. El ajuste por control es diagnóstico, no una estimación pareada ni una afirmación de significancia estadística. La optimización del puente sigue pendiente; no se declara cumplido el objetivo de alto rendimiento.

DOMParser, factories compartidas y el resto de la migración integral permanecen abiertos. La paridad de corpus y GC finito no prueban compatibilidad universal ni ausencia absoluta de fugas.
