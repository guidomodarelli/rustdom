# Contrato de SlotAssignmentAction: índices inversos

Se reemplazó la declaración `enum` por un objeto con propiedades `readonly`
y un alias de tipo derivado de sus valores. Se conservan el nombre exportado,
`SlotAssignmentInstruction.kind`, los demás campos de la instrucción y los
valores `Complete = 0`, `Signal = 1` y `Applied = 2`. El entrypoint ESM
continúa reexportando el contrato canónico CJS.

La implementación nativa expone únicamente nombres, sin índices numéricos
inversos. Las declaraciones ahora representan ese objeto real; no se cambió
código Rust ni runtime JavaScript.

## Regresión y corrección de la prueba

Los consumidores CJS y ESM ejercen la unión de valores, los nombres propios del
objeto real y la ausencia observable de sus tres índices inversos. Cada acceso
numérico lleva `@ts-expect-error`: con el enum anterior, el compilador permite
ese acceso y reporta la directiva sin usar en ambos consumidores. La
[evidencia previa](slot-assignment-action-types/types-before.log) conserva
ambos TS2578; el [typecheck final](slot-assignment-action-types/types-after.log)
aprueba con TypeScript 5.9.3 en modo NodeNext estricto.

La primera prueba instalada comparaba el objeto N-API con un literal mediante
`deepStrictEqual`. Esa aserción era incorrecta porque las propiedades del
addon son no enumerables; su impresión mostraba `{}`. Los
[descriptores observados](slot-assignment-action-types/native-action-shape.json)
confirman que también son no escribibles y no configurables. Se corrigió
únicamente la prueba para comparar los valores y `Object.getOwnPropertyNames`;
se conservó la comprobación de todos los índices inversos. El
[fallo original](slot-assignment-action-types/failed-enumeration-assumption.log)
y el [reporte fallido](../distribution/2026-09-13T09-07-13.410Z-linux-x64.json)
permanecen guardados. No se cambiaron expectativas arbitrariamente ni se usaron
mocks.

El gate local con emisión de JavaScript necesitó `--rootDir tests/distribution`
para resolver inequívocamente los exports del propio paquete. Esa corrección
afectó el comando de verificación, sin cambios de configuración de producción.

## Validación ejecutada

- `npm run build`: build Rust release con --locked y Cargo.lock y build JavaScript
  propios del clon; [log](slot-assignment-action-types/build.log).
- `node --test tests/slot-assignment-driver.spec.cjs tests/slot-assignment-state.spec.cjs`:
  8/8 contratos con addon real, incluyendo controles de liberación con GC;
  [log](slot-assignment-action-types/native-contracts.log).
- `node node_modules/typescript/bin/tsc --strict --module NodeNext --moduleResolution NodeNext --target ES2022 --esModuleInterop --skipLibCheck false --types node --rootDir tests/distribution --outDir .cache/action-type-consumers tests/distribution/consumer.cts tests/distribution/consumer.mts`:
  aprobado. Los consumidores CJS y ESM emitidos se ejecutaron con el addon real;
  [log](slot-assignment-action-types/local-consumers.log).
- `npm exec -- node scripts/package.mjs`: paquete creado sin publicación;
  [log](slot-assignment-action-types/package.log).
- `npm run test:package`, tanto en Node 24.14.1 como en Node 22.12.0: 36/36 gates.
  Se instalaron consumidores fuera del checkout con npm y pnpm y se ejecutaron
  TypeScript, CJS, ESM/VM, assets de workers, Jest, Vitest y Vitest VM reales.
- [v24.14.1: 18/18 gates](../distribution/2026-09-13T09-13-26.505Z-linux-x64.json).
- [v22.12.0: 18/18 gates](../distribution/2026-09-13T09-15-12.120Z-linux-x64.json).
- `git diff --check`: aprobado antes del commit.

La base verificada del fix es
`6da23cccf820022a3b2f7e73fc2603ed439ec733`, con
`main = b9bbf64a67a9acb42ce30524d732fd348819daba`.
No se reutilizó el addon ni dist del checkout principal.

Paquete validado SHA-256:
`7483b3813e1108a8d1c420d565fb520f2eada5332069d09f8f9bb4d7ec172924`.

Addon construido SHA-256:
`1dcda409e7b64dbbb2a8d7874f051afbddeaecc6042f1ba6456f6895fad24235`.

Cargo.lock SHA-256:
`50a2942ea6604b035c22b46801beb220c28f815e47282ee29eaed479a8fdd3f1`.

La reconstrucción del paquete después de corregir las aserciones produjo el
mismo hash: los consumidores se copian al proyecto externo por el gate y no
integran el archivo distribuido. Los reportes conservan versiones, comandos,
salidas, tiempos, hashes y lockfiles de las instalaciones.

## Alcance y memoria

El cambio sólo modifica declaraciones y pruebas consumidoras. No agrega
asignaciones de memoria, referencias persistentes, caches ni rutas de ownership. Los
controles focales existentes de GC aprobaron con el addon construido; se
conservan los reportes del [driver](../memory/2026-09-13T09-06-29.660Z-slot-assignment-driver.json)
y de [caches de asignación](../memory/2026-09-13T09-06-37.333Z-slot-assignment.json).
Esta prueba finita no implica ausencia absoluta de fugas. No se repitieron
benchmarks, WPT, corpus HTML5 ni toda la suite Rust por un cambio exclusivamente
de tipos, y no se afirma ninguna mejora de rendimiento ni compatibilidad total.
