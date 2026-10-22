# Web Storage: propuesta de auditoría, sin crédito de implementación nuevo

Esta propuesta clasifica implementación existente de la base3d37f899 y jsdom27.4.0.
Los cuatro inputs locales —bridge, dos archivos Rust y build— coinciden con las
fuentes archivadas de B en la preparación39720077911, artefacto12400802735.
Tres originales coinciden con el catálogo, cuatro archivos construidos con el
manifest oficial y el bridge construido cambia únicamente su import de native.
Fuentes y procedencia en `reports/validation/inventory-storage-audit/`.

La propuesta no incorpora Storage al ledger. La integración de geometría es un
WIP separado, también pendiente de validar; el catálogo derivado conserva sus
recuentos publicados. No se ejecutó Rust, DOM, addon, generador, suite o benchmark
durante esta auditoría. El ensayo de ownership sigue activo y no debe reiniciarse.

## Responsabilidades verificadas

| Referencia o consumidor | Clasificación propuesta y pendiente |
| --- | --- |
| `webstorage/Storage-impl.js` | Híbrido. Estado, UTF16, cuotas y cursores usan Rust; el driver de mutaciones/eventos conserva decisiones JavaScript. |
| `generated/Storage.js` | Pendiente. Constructor ilegal, branding, argumentos/coerciones, named properties y traps del Proxy siguen en WebIDL JavaScript. |
| `Window.Storage` | Pendiente. Su invocación pública rechaza construcción desde el wrapper JavaScript. |
| `Window.localStorage` y `Window.sessionStorage` | Pendientes. Sus getters comprueban origen opaco, eligen SecurityError y retornan wrappers desde JavaScript. Retornar un objeto respaldado por Rust no migra el algoritmo de acceso global. |
| Seis miembros de `Storage.prototype` | Híbridos. Usan datos Rust pero conservan WebIDL/proxy y, en mutaciones, el driver JavaScript. |

El build reemplaza Storage-impl con un shim y las áreas Map del constructor de
Window con NativeStorageArea. El control restante está en `web-storage.cjs`:
reemplazar un archivo original no retira sus algoritmos del runtime JavaScript.
No se propone auditar Window completo ni StorageEvent a partir de estos accesos.

La propuesta enumera diez anclas: cuatro Rust existentes (`length`, `key`,
`getItem`, supportedPropertyNames), tres híbridas (`setItem`, `removeItem`,
`clear`) y tres pendientes (`_dispatchStorageEvent` y sus dos callbacks).
Los IDs exactos están en `storage-audit-proposal.json`. El constructor interno
de asignaciones/aristas y el símbolo toStringTag quedan sin crédito y requieren
su decisión de alcance de bindings; no se inventa una migración para ese wiring.
Las nueve APIs son seis híbridas y tres pendientes, en una dimensión separada.

El getter de nombres usa un cursor cuyo orden, avance y agotamiento decide Rust.
`storageKeys` adapta sus resultados Option al Iterator de JavaScript sin elegir
claves ni su orden. Como con el transporte de snapshots de DOMRect, ese adaptador
mecánico no transforma por sí solo el algoritmo en híbrido. Los traps que consumen
los nombres permanecen en el wrapper generado y no se acreditan con ese getter.

Rust distingue valor ausente y string vacío, conserva code units UTF16, inserción,
overwrite y borrado/reinserción. `plan_set` calcula cuota y oldValue sin mutar;
el commit usa el estado actual después de la programación del evento. El host
todavía decide la secuencia completa, construye DOMException, omite eventos según
guards y programa el timer antes de modificar. La entrega selecciona en JavaScript
ventanas del origen distintas de la emisora, URL, storageArea y factory del evento.

## Evidencia existente y límites

`tests/web-storage.spec.cjs` compara ambas áreas y realms default/VM con jsdom
independiente: Unicode, coerción/reentrancia, quota, reserved names, descriptores,
iteración durante mutación, frames y eventos. `tests/web-storage-native.spec.cjs`
ejercita el addon real, planificación sin mutación, commit tras cambios, orden y
agotamiento de cursores y activación en áreas compartidas. Cuatro pruebas Rust
validan cuotas/UTF16, orden, cursor y compactación/liberación de capacidad.

Los resultados históricos de `reports/validation/web-storage.md` incluyen52
contratos —48 públicos y cuatro nativos—, cuatro tests Rust y WPT de1.277 resultados
en paridad, con tres fallos de estándar compartidos. Esos resultados no se
presentan como ejecuciones de esta auditoría ni certificación completa. Excluyen
particionamiento, popups y document.domain. El benchmark histórico no decide el
gate de rendimiento actual ni se volvió a ejecutar.

## Memoria y pasos restantes

El área es `Rc<RefCell<TrackedArea>>` con datos Rust; no conserva Window, Document,
callbacks o referencias N-API. El cursor comparte solo esos datos y suelta el Rc
al agotarse, sin tombstones acumulados. El bridge, wrappers y timers conservan
aristas visibles de ventanas mientras son necesarias, como la referencia.

`tests/helpers/web-storage-memory.cjs` observa por separado documentos, ventanas,
wrappers, áreas y cursores, retiene snapshots de strings y espera timers reales.
El histórico registra seis ciclos públicos y seis de cursores. Retener Storage
conserva sus owners; soltarlos permite recolectarlos. El cursor puede sobrevivir
al wrapper del área y libera el área al agotarse. Son escenarios finitos y no
memoria pico ni garantía absoluta de ausencia de fugas. Las transferencias N-API
ante fallos dependen además del hito de ownershipPR80, todavía no aceptado.

Antes de incorporar estas filas: revisar clasificación y fuentes, validar el
catálogo y sus contratos reales en Node22/24, conservar evidencia y comprobar
denominadores/IDs sin cambios. Ejecutar suites o generador después de que termine
el ensayo activo. No hay nuevo código Rust, fase completa ni porcentaje global:
alcance abierto, `migrationPercent=null`. Para retirar el módulo deben migrarse
los drivers de mutación/eventos y los consumidores WebIDL/origen correspondientes.
