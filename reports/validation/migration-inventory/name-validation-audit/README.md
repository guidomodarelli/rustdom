# Validación de la auditoría de nombres

Se auditó el módulo `living/helpers/validate-names.js` de jsdom 27.4.0 y sus
tres anclas. Quedan pendientes: validación léxica, extracción y restricciones
de namespaces siguen en JavaScript y `xml-name-validator`. La resolución
nativa de namespaces de nodos no completa este contrato. Hay seis módulos y
diecisiete anclas auditados, sin nuevo crédito Rust ni cambio del denominador.

Pasaron 13 pruebas por Node 22.12.0 y 24.14.1 sin skips: once del inventario,
el contrato HTML anterior y uno nuevo con 60 casos de nombres/namespaces, más
coerción, reentrancia, errores sin mutación y realms. El nuevo contrato usa
jsdom independiente y el paquete público real A0; no importa ni mockea el helper.
No es cobertura exhaustiva ni certificación normativa.

`evidence.tar.gz` conserva las 212 fuentes verificadas, todos los comandos,
logs, catálogos generados por ambos Node y las trazas de GC. `receipt.json`
fija su tamaño y hash. Las fuentes y las 7.246 anclas de referencia son idénticas
al catálogo anterior. Las 4.374 APIs, constructores, aliases y declaraciones
heredadas coinciden entre Node; los perfiles y exclusiones ECMAScript difieren.
Las únicas cuatro clasificaciones cambiadas son el módulo y sus tres anclas.
`comparison.json` registra estas distinciones, sin equiparar todas las salidas.

La inspección conserva originales y archivos construidos A0/C en el tar,
junto con el diff completo. El único agregado es el adaptador local de require;
`reference-and-built.json` registra los hashes. La preparación oficial
39720077911/12400802735 se autenticó completa antes y después de cada Node con
su verificador congelado, y las cuatro identidades son iguales. No se alteraron
paquetes ni fuentes del ensayo de ownership que corre en GitHub.

Las dependencias físicas del fixture Linux se copiaron del fixture anterior
de strings, conservando jsdom y TypeScript 5.9.3. Las suites amplias de Rust,
Jest y Vitest no se reejecutaron: este incremento cambia el catálogo y sus
pruebas, sin modificar el producto. Los benchmarks del CLI y la memoria del
generador se guardan por separado. Esta rama sigue separada hasta cerrar #80.
