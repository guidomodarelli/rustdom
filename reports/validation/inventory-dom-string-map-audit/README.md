# Evidencia estática de DOMStringMap

sources.tar.gz conserva 31 miembros: ocho fuentes locales verificadas contra el
snapshot oficial, cinco fuentes de referencia contra el catálogo, cinco
archivos construidos contra el manifest B, tests actuales, antecedentes,
index completo, productor y propuesta. raw-files.json registra tamaños/hashes;
receipt.json conserva su procedencia. El SHA-256 del archivo es
246f28dc3f7903a1aee873726ba7e126b3b4c1d7df6d79ab6e2d8b7ee895233d.

El index oficial es el preservado en PR80, preparación
99fb5dd8-2ee8-402c-97b4-d8174069f933, run39720077911/artifact12400802735:
cb30a9c13d612a14700f76a36f246ceb85cb0281aad3696f8f2e86a460307874.
Se leyeron cinco archivos físicos de B y sus bytes coincidieron con su manifest;
no se ejecutó ni se verificó de nuevo el árbol completo o el binario nativo.

Desde la raíz del repositorio, ejecutar
`python3 reports/validation/inventory-dom-string-map-audit/verify-static.py`
comprueba el archivo, los IDs estables, su cobertura y los recuentos vigentes.
catalog-integrity.json fija los seis archivos originales del catálogo y ledger.
El verificador además coteja las fuentes preservadas con el index oficial,
el manifest B, el catálogo y los ocho archivos locales actuales.
No carga DOM ni ejecuta addon, generador, suites, GC o benchmarks. El estudio
original ownership sigue activo y no se repite ni se agrega carga de suites.

La propuesta fuera del ledger tiene doce filas y dos diferidas. Son seis anclas
Rust existentes y tres híbridas, un módulo híbrido, uno pendiente y una API
pendiente. No agrega implementación. Los getters dataset de HTMLElement y
SVGElement son consumidores fuera de la propuesta; las operaciones dinámicas
del Proxy siguen como brecha del alcance. No hay porcentaje defendible todavía.

Los logs y mediciones del tar son antecedentes, sin ejecución nueva o aceptación
de rendimiento. Las decisiones y límites están en
reports/progress/inventory/dom-string-map-audit.md.
