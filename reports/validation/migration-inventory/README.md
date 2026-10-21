# Validación del catálogo inicial

Este cambio agrega tooling y documentación. No modifica algoritmos DOM, fuentes
Rust, el SDK N-API, bindings de producción ni adaptadores de Jest/Vitest.

| Entorno | Node | Contratos nuevos | Suite de tooling completa |
| --- | --- | ---: | ---: |
| Linux local en WSL2 | 22.12.0 | 7/7 | 16/16 |
| Linux local en WSL2 | 24.14.1 | 7/7 | 16/16 |
| Windows nativo | 22.12.0 | 7/7 | No repetida |
| Windows nativo | 24.14.1 | 7/7 | No repetida |

Comandos: `npm run test:validation` en Linux y
`node --test tests/validation/migration-inventory.spec.mjs` en Windows. La suite
de tooling ya forma parte del CI de Linux, Windows y macOS; macOS y la matriz
integral del producto quedan sujetos al CI del PR. Los logs finales están en
`contracts-v*.log` y `contracts-windows-v*.log`. El run adicional de Windows
24.21.0 también se conserva.

Los tests usan jsdom 27.4.0 independiente y bibliotecas reales. Ejercen clonado,
atributos, URL, cookies, descriptores unforgeable, herencia, exports, evidencia de
auditoría, generación independiente y el CLI. No se introdujeron mocks.

## Regresiones y diferencias observadas

- La primera enumeración omitía clases exportadas mediante getters de namespaces;
  el caso real de cookies detectó la ausencia de CookieJar.setCookie.
- El contador mutable Cookie.cookiesCreated cambiaba el hash después de crear una
  cookie. El catálogo conserva tipos/descriptores y solo materializa constantes
  de datos no reconfigurables ni escribibles.
- `locale-before-fix.log` conserva la regresión negativa: inglés y turco producían
  hashes diferentes con las mismas APIs. Se reemplazó la colación por orden
  UTF-16. Los dos locales se ejercen realmente en POSIX.
- Windows ignora esas variables de locale para ICU. Se confirmó con Node nativo;
  allí el test informa la limitación y verifica todo el orden ordinal sin cambiar
  la configuración del usuario. No se afirma haber probado dos locales en Windows.
- Una ejecución directa inicial omitía el contexto npm que requiere un test
  preexistente. Se volvió a ejecutar mediante el comando npm real.
- Mezclar Node Linux con dependencias en NTFS, o Node Windows con dependencias
  sobre UNC de WSL, produjo tiempos de acceso que excedieron límites del CLI.
  Las ejecuciones válidas usan dependencias locales de cada plataforma. Los
  intentos previos conservados en `history/` no se consideran aprobados.

`cross-runtime.json` confirma igualdad de APIs, constructores, aliases y grafo
entre ambos Node. Los cuatro globals ECMAScript adicionales de Node 24 se
conservan como exclusiones observadas, sin ocultar la diferencia de perfiles.

## Procedencia

`provenance.json` registra hashes de fuentes, test, helper de memoria y lockfile.
Las fuentes del entorno Linux preparado coinciden con el worktree administrado:
`993a1efdbd928991028f8831c62ef65fe4612b1797727afda3870c5058a87415`.

Los snapshots crudos por Node se conservan en `catalog-v*.tar.gz`; después de
extraerlos se comprobaron los cinco digests contra `generation-v*.json`. No se
duplican sus JSON grandes fuera del archivo comprimido. El catálogo legible
versionado está en `reports/progress/inventory/`.

`dependency-provenance.json` confirma las versiones y hashes de package.json de
las veinte dependencias directas de la referencia, tanto en la instalación Linux
como en la instalación Windows, y registra el digest del lockfile del proyecto.

La revisión independiente de Codex detectó los dos P2 de locale: orden dependiente
del host y suposición incorrecta en Windows. Ambos se verificaron y corrigieron.
El mismo reviewer volvió a revisar código, documentación y evidencia, y cerró
con cero hallazgos accionables sobre el estado final. Fue una revisión estática
y de cálculos guardados; no ejecutó cargas ni modificó archivos.

## Alcance de las conclusiones

Estos resultados prueban el generador y los casos ejercidos, no que el inventario
esté auditado por completo ni que rustdom sea compatible al 100%. No se repitieron
localmente Cargo, Clippy, Jest, Vitest, corpus, WPT o Memcheck por este cambio de
tooling; no se usa su evidencia histórica para afirmar una nueva validación
integral. El CI del PR ejecuta sus gates normales antes del merge.

Los escenarios de liberación también se conservan en
`reports/memory/migration-inventory/`; las mediciones del CLI están en
`reports/benchmarks/migration-inventory/`.
