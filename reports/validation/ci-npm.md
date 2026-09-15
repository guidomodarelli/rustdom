# CI: instalación de consumidores con Node 22 y npm fijado

Cambio acotado al workflow: después de seleccionar Node 22.12.0 en Linux se
instala npm 11.19.0. Se mantiene el mismo runtime mínimo y se ejecutan los
controles reales de npm/pnpm, sin --force ni --legacy-peer-deps.

## Reproducción y comparación

El job Linux del PR67, commit bf426c441cced03aed4ac575a53baddff452096e,
falló al resolver peers con npm 10.9.0: Cannot read properties of null
(reading 'edgesOut'). La instalación no llegó a los consumidores.
El error original queda en ci-npm/github-linux-failure.log.

Se reprodujo localmente con Node 22.12.0/npm 10.9.0 usando un archivo real:
reports/distribution/2026-09-15T13-45-19.409Z-linux-x64.json (pass=false).
El stack de Arborist y sus versiones quedan en ci-npm/npm10-stack.log.

Con npm 11.19.0, el MISMO archivo pasó los 18 controles de npm/pnpm:
instalación, TypeScript, CJS, Unicode, ESM/VM, workers y activos, Jest,
Vitest y Vitest VM. Reporte:
reports/distribution/2026-09-15T14-00-11.774Z-linux-x64.json (pass=true,
18 exitCode=0, sin señales ni errores de spawn).

- Runtime de ambos intentos: Node 22.12.0.
- Archivo SHA256: 341f2e8bcbfd0353c4959e604a0a00b49df0120941a214d8ce68432b40ff5185.
- Addon SHA256: 452e609198336589594f95e262d9346fee5630c6bec138809836bd413e320687.
- npm candidato: 11.19.0, instalado localmente solo dentro del clon de validación.
- CI lo instala en el prefijo global del runner efímero, después de setup-node.
- No cambian dependencias de producción ni el lockfile de rustdom.

El manifest oficial de [npm 11.19.0](https://github.com/npm/cli/blob/v11.19.0/package.json)
admite Node ^20.17.0 o >=22.9.0. La familia del fallo de peers está documentada
en [npm/cli #8261](https://github.com/npm/cli/issues/8261); la aprobación aquí
se apoya en la reproducción y la instalación ejecutadas, no solamente en ese issue.

## Procedencia y límites

El clon de CI partió exactamente de bf426c4. Se reutilizó el dist del clon
validado de FormData después de comprobar igualdad de commits, ausencia de
cambios de runtime y hash del addon contra native-build.json. Se creó un
archivo nuevo desde ese runtime; no se presenta esta reutilización como
otra compilación Rust. El cambio del workflow no modifica código de DOM.

Los logs y lockfiles de los consumidores están versionados. El wrapper local
terminó con un error de CR residual DESPUÉS de que package-check escribiera
pass=true y completara sus 18 comandos: cada comando tiene exitCode=0 en el
reporte. Se corrigieron los finales de línea del wrapper separado en .cache;
ese incidente no se oculta ni se clasifica como fallo de los consumidores.
El workflow ejecuta directamente npm run test:package y no utiliza ese wrapper.

Los checks remotos del commit nuevo todavía deben completarse. No se midió
rendimiento DOM para una modificación de herramienta de CI, ni se afirma
ausencia universal de fugas a partir de estos controles.
## Aplicación al PR43

El job Linux 104404082575 del run 34976101545 reprodujo el mismo fallo de
Arborist con npm 10.9.0 durante la instalación de consumidores Node 22.
Se aplica exactamente el ajuste de herramienta ya validado en PR67; los
18 controles y el archivo referenciado arriba se reutilizan como evidencia
de esa comparación, no se presentan como una ejecución local nueva de PR43.
La implementación del guard de bosques y sus pruebas permanecen intactas.
Los checks remotos del nuevo SHA de PR43 deben validar su unión antes del merge.
