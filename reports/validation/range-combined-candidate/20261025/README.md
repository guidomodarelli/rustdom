# Validación local del candidato combinado — 2026-10-25

Base Git real f781c3b7, diez cambios de runtime aislados y ELF Linux
ce91c742bc5b51b4f0e7d06469b309131f114a1a017bc15a2d162eed95039ba8.
La producción no cambia. No hay benchmark nuevo ni aceptación de rendimiento.

| Validación | Node22.12.0 | Node24.14.1 |
| --- | ---: | ---: |
| Contratos generales | 3784 | 3784 |
| Contratos del proceso WPT | 9 | 9 |
| Dirigidos Range/StaticRange e interacción pública | 84 | 84 |
| Jest | 22 | 22 |
| Vitest | 33 | 33 |
| VM | 34 | 34 |
| Consumidores CJS/ESM ejecutados tras compilación estricta | 2 | 2 |
| Corpus HTML: paridad / total | 1784/1792 | 1784/1792 |
| Fixtures WPT seleccionadas | 240 | 240 |
| Assertions WPT por motor | 83007 | 83007 |
| Assertions fallidas compartidas con jsdom | 1203 | 1203 |

315tests Rust en1.99.1, formato y Clippy con warnings como errores pasan.
Los contadores de tests se solapan entre suites: no sumarlos como cobertura nueva.
Los ocho casos HTML con scripting quedan excluidos, sin mismatches en los demás.
WPT conserva `complete=false`: Range-deletion continúa bloqueado por el bootstrap
CDATA/HTML de jsdom y el fixture de clicks/layout exige navegador real.
Los fallos compartidos y las assertions originales están íntegros; paridad no
significa conformidad completa con estándares. El runner conserva mensajes crudos
y su normalización histórica declarada solo para el Date de Blob inválido.

Node22 usó el checkout `source`; Node24 un segundo checkout Git Linux real
`roundtrip`, con las diez fuentes idénticas y el mismo ELF copiado, más sus propios
reportes. Las pruebas dirigidas/tipos/memoria de ambos SDKs usaron el primero.
Los estados reales de Git y las rutas quedan registrados, sin normalizarlos.
Ambas suites completas terminaron exit0. Las ejecuciones fueron funcionales y
algunas se solaparon: sus tiempos de log no son resultados de rendimiento.

`qa.zip` preserva todos los logs, comandos, reportes generados —incluidos los dos
WPT íntegros—, contadores/recursos, fuentes compiladas y manifests de build.
`qa.json` autentica cada miembro y el ZIP. No ejecutar sus scripts: son inspección.
El ELF está completo en `native-linux-x64.node.gz`; su digest se coteja con
`native-build.json` y `source.json`. Los locks/manifests reales están registrados.
La primera preparación falló antes de crear el checkout por intentar leer un
gitfile Windows desde Git WSL; se corrigió usando el directorio Git común real.
También se conserva el intento de empaquetado que suponía un rust-toolchain.toml
inexistente: se documentó el compilador real y los cuatro manifests presentes.
Ninguno de esos errores cambió código, assertions o mediciones ni repitió tests.

Incluye los artifacts/API/logs autenticados del CI de lectores:
40160504234/09b86d33 (artifact12585808707,9318B,SHA718c8897...) y
40161044874/f781c3b7 (artifact12586648557,10009B,SHA6f2aeae7...). Ambos aprobaron
reconstrucción/replay de datos existentes en los SDKs fijos; el segundo también
los ocho contratos de exploración. No son CI funcional del candidato combinado.
La primera colección conservó un JSON derivado del run; la respuesta API terminal
original también está separada y preservada. No se ejecutó DOM en esos lectores.

La revisión inicial del patch y cuatro casos nuevos cerró sin hallazgos; el
cierre integral de este paquete se registra en el recibo final. Los599pins y
48entradas ajenas siguen intactos. Falta CI funcional del candidato en plataformas,
calificación de rendimiento prospectiva e integración. No tag/merge ni crédito
nuevo al inventario. Objetivo general activo, runtime todavía híbrido.
