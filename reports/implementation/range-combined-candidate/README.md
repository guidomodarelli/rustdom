# Candidato combinado de StaticRange y colapso nativo

Este candidato combina dos cambios Rust ya revisados: construcción de StaticRange
y colapso atómico cuando los owners coinciden. **No está integrado en el runtime
publicado y no tiene calificación de rendimiento.** No incrementa la migración
acreditada ni habilita tag/merge de ownership. El objetivo general sigue abierto.

`source.json` fija el Git base f781c3b7549a86b6aa8b5a34d2bbb32038c315b7,
los diez preimages, los diez resultados y el patch7fe5ec800e30db89c8b12cf41fc6af3daacb71861fc5db3ead5e5aec943bdf94.
El ELF Linux nuevo es ce91c742bc5b51b4f0e7d06469b309131f114a1a017bc15a2d162eed95039ba8;
no sustituye a ninguno de los paquetes históricos A0/A1/J0/J1/B.

## Responsabilidades y decisiones

- `RangeState` conserva ambos endpoints y aplica el colapso atómicamente en Rust.
  Los errores por estados parciales no cambian el estado; se preservan NaN,
  offsets no finitos y los bits de cero negativo donde corresponde al API nativo.
- El controlador StaticRange Rust decide validación de nodeType, orden de lecturas,
  cortocircuito y creación después de callbacks. No conserva referencias JS ni
  préstamos de TreeStore a través de getters o callbacks; preserva valores
  lanzados, reentrancia y errores del realm.
- El binding conserva conversiones WebIDL, factories y referencias DOM visibles
  a V8. Cuando los owners coinciden, Rust cambia offsets y el host evita repetir
  aristas/registraciones sin cambios. La ruta anterior permanece para owners distintos.
- `interaction.spec.cjs` compara los dos motores reales: snapshots estáticos
  independientes de clones/colapso/mutación, raíces desconectadas y rechazo de
  constructores sin corromper estados vivos. No hay mocks de plataforma.

La combinación se aplicó primero con `git apply --check`. Después se reconstruyó
en otro checkout Git Linux real y limpio del base, obteniendo exactamente las
mismas diez fuentes compiladas. Ambos patches de entrada y sus hashes se conservan.
El frontend continúa híbrido; este candidato no retira otras delegaciones a jsdom.

## Reproducción en un checkout nuevo

Usar el repo publicado como `CURRENT` y otro directorio para `CANDIDATE`.
No aplicar el patch sobre los paquetes de estudios ni sobre un árbol ajeno.
Git base y hashes deben coincidir con `source.json` antes y después de aplicar.

```sh
git clone --no-checkout https://github.com/guidomodarelli/rustdom.git "$CANDIDATE"
git -C "$CANDIDATE" checkout --detach f781c3b7549a86b6aa8b5a34d2bbb32038c315b7
git -C "$CANDIDATE" apply --check "$CURRENT/reports/implementation/range-combined-candidate/range-combined.patch"
git -C "$CANDIDATE" apply "$CURRENT/reports/implementation/range-combined-candidate/range-combined.patch"
cp -R "$CURRENT/reports/benchmarks/native-class-ownership/range-collapse-candidate/functional/." "$CANDIDATE/tests/"
cp "$CURRENT/reports/implementation/range-combined-candidate/interaction.spec.cjs" "$CANDIDATE/tests/combined-range-candidate.spec.cjs"
cd "$CANDIDATE"
npm ci --no-audit --no-fund
cargo +1.99.1 fmt --check
cargo +1.99.1 test --release --locked --lib
RUSTUP_TOOLCHAIN=1.99.1 node scripts/build-native.mjs
node scripts/build.mjs
export RUSTDOM_STATIC_RANGE_SOURCE="$PWD"
export RUSTDOM_COMBINED_SOURCE="$PWD"
node --expose-gc --test --test-concurrency=1 tests/range-*.spec.cjs tests/combined-range-candidate.spec.cjs "$CURRENT/reports/implementation/static-range-candidate/public.spec.cjs"
npm run test:compat
npm run test:jest
npm run test:vitest
npm run test:vm
npm run test:corpus
npm run test:wpt
node --expose-gc "$CURRENT/reports/implementation/static-range-candidate/memory.cjs"
node --expose-gc tests/helpers/range-collapse-memory.cjs
```

Ejecutar con Node22.12.0 y24.14.1 fijados. La evidencia registra los hashes de
los ejecutables, Rust1.99.1, Cargo/lockfiles y el ELF realmente cargado. La
reproducción de fuentes es exacta; no se promete un binario idéntico al compilar
en otra ruta/plataforma/toolchain. El ELF almacenado corresponde a Linux x64.
No ejecutar scripts del ZIP QA; reconstruir desde Git y el patch actual.

## Evidencia y trabajo restante

Ver [validación completa](../../validation/range-combined-candidate/20261025/README.md)
y [memoria](../../memory/range-combined-candidate/20261025/README.md).
La calificación local completa es Linux/WSL. Windows/macOS del candidato nuevo
siguen pendientes, al igual que CI funcional específico y benchmarks prospectivos.
No se presenta el CI de lectores como validación de este runtime candidato.
`performanceAccepted=null`, `gateReevaluated=false`; los rechazos históricos
permanecen vigentes. No repetir capturas consumidas, cambiar sus pins ni pedir
otra autorización operativa. La migración de producción sigue incompleta.
