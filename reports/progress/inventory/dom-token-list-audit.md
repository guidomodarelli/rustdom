# DOMTokenList: correspondencia estática y propuesta de clasificación

Esta propuesta registra implementación existente; no migra producto ni modifica
el ledger. Dos módulos, dieciocho anclas y once APIs tienen propuestas explícitas
en `dom-token-list-audit-proposal.json`. Los totales vigentes siguen siendo
18 módulos, 32 APIs y 55 anclas auditadas, con denominadores 531/4374/7246,
scopeClosed=false y migrationPercent=null. No se suman dimensiones ni se acredita
Rust nuevo. La propuesta cuenta con revisión estática y requiere validación
funcional antes de incorporarse.

Se verificaron seis fuentes locales contra sus bytes archivados en la preparación
oficial39720077911, artefacto12400802735. Se comprobaron cuatro fuentes del jsdom
27.4.0 independiente contra el catálogo y cuatro archivos físicos del paquete B
contra su manifest autenticado. El shim construido activa el bridge token-list;
reemplazar ese archivo no retira todos sus algoritmos del runtime JavaScript.
Fuentes completas, tests existentes, antecedentes y procedencia están en
`reports/validation/inventory-dom-token-list-audit/`. No se cargó el addon,
ejecutó DOM, generador, suite, GC ni benchmark durante esta auditoría estática.
El estudio de ownership sigue activo y no se repite ni se contamina con suites.

## Responsabilidades

| Parte | Correspondencia y pendiente |
| --- | --- |
| `nodes/DOMTokenList-impl.js` | Híbrido: Rust conserva datos y algoritmos de tokens; el bridge conserva errores, vistas y efectos. |
| `generated/DOMTokenList.js` | Pendiente: branding, coerción de argumentos, reacciones y Proxy siguen en JavaScript. |
| `token_list.rs` | Conjunto ordenado UTF16, parsing, validación, membresía, replace estable, serialización y compactación nativas. |
| `token_list_binding.rs` | Lee atributos del forest, sincroniza dirty, decide force/noop y devuelve el plan de escritura. No aplica por sí solo los efectos del atributo. |
| `token-list.cjs` | Owner visible a V8, cache de vista, composición de excepciones, consumo del plan y llamada al driver real de atributos. |
| `helpers/ordered-set.js` | Sigue publicado como dependencia JavaScript de otros consumidores. No se acredita el módulo por la sustitución particular de DOMTokenList. |

Se proponen siete cuerpos Rust existentes: `attrModified`, `_syncWithElement`,
`_serializeSteps`, `length`, `item`, `contains` y el getter `value`. Sus decisiones se ejecutan en
NativeTokenList/TokenSet y el TreeStore; cantidad, booleano, UTF16 y Option cruzan
N-API como transporte. No se completa por eso su consumidor público WebIDL.

Diez cuerpos quedan híbridos. La validación y precedencia de tokens son nativas,
pero `_mutate` todavía elige y construye DOMException según status, y llama al
driver de atributos si el plan contiene escritura. Soporte de tokens combina
lowercase/membresía Rust con el TypeError y su mensaje JavaScript. `tokenSet` e
índices conservan la elección de vista y su generador JavaScript. La revisión
corregió la propuesta inicial de `attrModified`: marcar dirty está en Rust y
descartar la referencia cacheada mantiene coherencia mecánica del wrapper. Esa
infraestructura puede permanecer en JavaScript y no exige migración adicional.
El setter `value` permanece pendiente: delega al driver JavaScript de atributos.

El snapshot de la propuesta inicial y su productor se conservan como antecedentes:
`original-proposal.json` fuera del tar y el productor original dentro. La corrección
posterior de review cambia una clasificación, no fuentes ni resultados históricos.

Las once APIs propuestas son diez híbridas y el constructor público pendiente.
El constructor interno se deja fuera de crédito hasta resolver la frontera de
aristas/factories. También se conservan sin clasificación nueva los cinco aliases
de Array del realm (`@@iterator`, keys, values, entries, forEach) y toStringTag.
No se impone reimplementar V8 en Rust: falta auditar esos bindings y los accesos
al Proxy en el cierre de alcance. Todos esos IDs diferidos figuran en la propuesta.

## Pruebas existentes y límites

`tests/dom-token-list.spec.cjs` compara jsdom independiente y rustdom a través de
classList, relList y htmlFor en siete familias HTML/SVG/XML: Unicode y surrogates,
espacios exactos, atributos ausentes/namespaces, precedencia de errores, writes y
MutationObserver, reemplazo, índices, conversión reentrante e iteración viva.
El archivo nativo actual tiene seis contratos de planes, invalidación, snapshots,
forests, soporte, capacidad dispersa y rechazo de owner con metadata inválida.
Cuatro tests Rust cubren validación, orden, parsing UTF16 y liberación de capacidad.

Los logs históricos preservados registran175casos públicos, cinco contratos
nativos y cuatro tests Rust; el sexto contrato nativo es posterior. No se afirma
que esos logs validen el archivo actual completo ni que se hayan vuelto a ejecutar.
Los resultados WPT, exclusiones y presupuestos históricos están en
`reports/validation/dom-token-list.md`; no certifican estándares completos ni
aceptan el gate de rendimiento de ownership. Las regresiones históricas de listas
pequeñas y replace tampoco se convierten en mejoras por esta auditoría.

## Ownership y memoria

NativeTokenList conserva NodeId, nombre UTF16, Weak del identificador del forest
y Rc de datos TokenSet; no almacena Window, Element o callbacks N-API. El bridge
mantiene el owner Element visible a V8. Una lista pública retenida puede retener
sus owners; soltarlos debe permitir GC. El snapshot NativeTokenSet comparte solo
datos del conjunto y puede sobrevivir al árbol/lista originales. Sincronizar dirty
reemplaza el Rc del conjunto y preserva las vistas anteriores con sus propios datos.

El helper existente observa Window y Document por separado, retiene y suelta tres
listas durante seis ciclos y conserva un snapshot sin su forest/lista originales.
Se preservan el fallo inicial causado por el frame async del test y los resultados
posteriores corregidos. Son antecedentes finitos, no una ejecución de esta
auditoría, prueba de memoria pico ni garantía absoluta de ausencia de fugas.
Las transferencias N-API en errores dependen además del hito ownershipPR80 abierto.

Para incorporar la propuesta: revisar decisiones y fronteras, validar el catálogo
y comportamiento relevante en Node22/24 después del estudio activo, conservar
fuentes/resultados y comprobar denominadores e IDs. Para retirar el módulo del
runtime JavaScript también deben migrarse la orquestación de mutaciones, errores,
efectos y consumidores pendientes. No hay fase completa ni porcentaje global nuevo.
