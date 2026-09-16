# Contraprueba del supuesto cortocircuito checkbox/radio

**Conclusión: el comentario 4021434614 no aplica a la referencia jsdom 27.4.0.** Producción permanece intacta. El bloque de exclusión usa dos if secuenciales en jsdom; el bucle Rust reproduce esas lecturas. El `||` que menciona el comentario corresponde al bloque posterior que obtiene el valor, donde Rust ya usa cortocircuito.

Base: `30bad7e5b8f72b112a0e30795f07e8cfd98da5c0`, PR 67, `feature/native-form-data`; `main` verificada en `ece7d46c9cdb94eea3c23e517b341771ee9719d4`. Runtime real suministrado por el coordinador, addon SHA-256 `b3fcad02f2cbedff348930d9f9374b36f5d497b7f92f68b80f242dcb4ae0f903`.

## Fuente y comportamiento

La fuente instalada coincide exactamente con [FormData-impl.js del tag oficial v27.4.0](https://github.com/jsdom/jsdom/blob/v27.4.0/lib/jsdom/living/xhr/FormData-impl.js):

- Git blob: `fd779652a44b4074a3ba595c59afc19aed2f6aae`.
- SHA-256: `4c4b0e95d2dce8b348e77bd652ac217c1bf12ac7411066a7b6b064c28c5859fa`.
- La exclusión comprueba primero `type === "checkbox" && _checkedness === false`, y después vuelve a leer `type` para la comprobación independiente de radio.

Se ejercieron 84 escenarios reales por runtime: default/VM; checkbox/radio/text; checked true/false; trazas sin efectos, cambio de name en lectura dos/tres, throws en lectura dos/tres, throw de checkedness y transición de checkbox marcado a radio desmarcado. Los outputs, el orden de getters y la identidad/cause de excepciones coinciden entre ambos motores. Se comprueba que la construcción nativa fue invocada y que su contador activo vuelve a cero.

Contraprueba decisiva: el getter devuelve checkbox para la primera comprobación y radio en la siguiente, mientras cambia checkedness a false. Ambos motores observan `checked:true`, después `checked:false` y producen una lista vacía. Fusionar las comprobaciones con `||` eliminaría la segunda lectura y perdería esa exclusión. Las mutaciones de name también producen el mismo nombre `renamed` y trazas idénticas en ambos motores; el setter puede causar reentrancia adicional que se conserva en los registros.

## Auditoría de las demás condiciones del constructor

| Condición | Correspondencia |
| --- | --- |
| datalist / disabled | Rust `||` conserva el orden de los dos early-continue de jsdom |
| isButton y distinto de submitter | Mismo `&&` y orden |
| checkbox / radio no marcados | Dos comprobaciones secuenciales, no `||` |
| input y type=image | Mismo `&&`, después de capturar name |
| name null / vacío | Mismo cortocircuito sobre el valor ya capturado |
| selectedness e isDisabled de select | Mismo `&&` y comparación estricta con true |
| input y checkbox/radio para obtener valor | Mismo `&&` con `||` interno; Rust ya lo conserva |
| type=file / dirname no nulo ni vacío | Relectura posterior y condiciones coincidentes |
| Validación del submitter | Mismo orden antes de recorrer controles |

No se identificó otra diferencia observable que justifique alterar este archivo. No se cachea type globalmente.

## Validación y entrega

- Node 24.20.0: 84/84.
- Node 22.12.0: 84/84.
- Linux x64/WSL Ubuntu 22.04; jsdom 27.4.0 independiente y addon real.
- Tests nuevos: `tests/form-data-observable-types.spec.cjs` y fixture `tests/helpers/form-data-observable-types.cjs`.
- Logs/hash de fuente: `reports/validation/pr67-formdata-checkbox-shortcircuit/`.
- Todas las trazas y resultados: JSON `*-formdata-observable-types.json` en `reports/compatibility/`.

El cambio agrega únicamente pruebas y evidencia. No se recompiló ni se afirma haber repetido Rust/GC/benchmarks porque no cambió código de runtime. El cierre o rechazo en GitHub pertenece al coordinador; este subtrabajo no publicó comentarios ni reacciones.