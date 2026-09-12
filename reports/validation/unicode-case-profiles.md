# Perfiles Unicode de nombres de atributos

## Alcance

Corrección del hallazgo `3994404055` del PR #8, inicialmente revisado sobre
`ddffb273be76a311879785c06b6e0dcc20d67560`.

El filtrado nativo de nombres soportados de `NamedNodeMap` debe usar las tablas
del host. El selector anterior rechazaba Unicode 15.1 y trataba una conversión
identidad explícita como si cambiara el carácter.

Se reutilizan `unicode-case-mapping` 0.5.0 para Unicode 15.0/15.1 y 1.0.0 para
Unicode 16.0; el perfil nativo usa las tablas de Rust, actualmente Unicode 17.0.
Las dos dependencias están fijadas exactamente en Cargo.toml/Cargo.lock.
La selección y el filtrado se ejecutan en Rust. No se delega este comportamiento
a JavaScript ni se cambia el rango `engines`.

## Versiones de Node comprobadas

Comando ejecutado con cada binario Linux oficial ya instalado en el proyecto:

```sh
node -p 'JSON.stringify({node:process.version,unicode:process.versions.unicode,icu:process.versions.icu})'
```

| Node | Unicode | ICU |
| --- | --- | --- |
| v22.12.0 | 16.0 | 76.1 |
| v24.14.1 | 17.0 | 78.2 |

La afirmación del hallazgo que atribuye Unicode 15.1 al binario oficial de
Node 22.12.0 no se reproduce. Su
[cabecera ICU publicada](https://github.com/nodejs/node/blob/v22.12.0/deps/icu-small/source/common/unicode/uchar.h)
también define `U_UNICODE_VERSION` como 16.0. Node permite compilaciones con
[ICU del sistema](https://nodejs.org/api/intl.html#options-for-building-nodejs),
por lo que el perfil se selecciona usando la versión efectiva del host,
sin inferirla únicamente desde la versión de Node.

## Equivalencia de Unicode 15.0 y15.1

Se descargaron los archivos oficiales de Unicode desde el repositorio
`unicode-org/unicodetools`, en
[`unicodetools/data/ucd/15.0.0/`](https://github.com/unicode-org/unicodetools/tree/main/unicodetools/data/ucd/15.0.0)
y [`unicodetools/data/ucd/15.1.0/`](https://github.com/unicode-org/unicodetools/tree/main/unicodetools/data/ucd/15.1.0).

Comparación ejecutada:

- `UnicodeData.txt`: extraer pares de código y campo de minúscula (índice 13)
  cuando ese campo no está vacío. Hay 1.433 pares en cada versión y cero
  diferencias entre ambas.
- `SpecialCasing.txt`: quitar comentarios y líneas vacías, conservar los
  registros completos. Hay 119 registros en cada versión y cero diferencias.

Esto comprueba que las tablas de minúsculas Unicode 15.0 de la dependencia 0.5.0
sirven también para el predicado de cambio a minúsculas de Unicode 15.1.
No se afirma equivalencia de todas las propiedades Unicode.

| Archivo | SHA-256 |
| --- | --- |
| 15.0.0/UnicodeData.txt | `806e9aed65037197f1ec85e12be6e8cd870fc5608b4de0fffd990f689f376a73` |
| 15.1.0/UnicodeData.txt | `2fc713e6a31a87c4850a37fe2caffa4218180fadb5de86b43a143ddb4581fb86` |
| 15.0.0/SpecialCasing.txt | `78b29c64b5840d25c11a9f31b665ee551b8a499eca6c70d770fcad7dd710f494` |
| 15.1.0/SpecialCasing.txt | `55a477efd933a52cd27e6a9bf70265bb2d8814af31aab07767abc8eb421f27ef` |

## Pruebas de comportamiento

El test Rust de `attribute_names` crea una colección real de atributos y cambia
el perfil 15.1/16.0/17.0. Comprueba:

- U+A7CB cambia a minúscula desde Unicode 16 y U+A7CE desde Unicode 17.
- `ß` y `ﬀ` permanecen soportados aunque las tablas contengan una conversión
  identidad explícita distinta del sentinel de ceros.
- `UPPER` e `İ` quedan filtrados en los tres perfiles.
- La enumeración completa y el modo sin filtrado HTML preservan todos los nombres.
- Rechazar una versión desconocida no modifica el perfil seleccionado.

Validación ejecutada en el clone efímero, con Rust 1.98.1 sobre WSL Ubuntu 22.04:

- `cargo test --lib`: 21 tests aprobados.
- `cargo clippy --locked --all-targets -- -D warnings`: aprobado.
- `git diff --check`: aprobado.

## Memoria

El cambio agrega tablas estáticas y reemplaza un booleano por un enum por árbol.
No agrega ownership de nodos, referencias N-API, caches dinámicos ni callbacks.
Los tests nativos existentes de liberación de referencias de atributos también
pasaron. Esta inspección no constituye una demostración absoluta de ausencia
de fugas; el estrés completo del PR se registra por separado.
