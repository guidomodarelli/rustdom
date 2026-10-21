# Construcción nativa interrumpida: consumidor integrado

El 2026-10-21 se ejecutó `NativeRange.copy`, ya integrado en main, desde ocho
workers reales por versión de Node. Cada worker anuncia su entrada y copia
rangos hasta que el padre solicita su terminación. Después del evento `exit`,
el padre consulta los contadores nativos compartidos del mismo addon.

| Binario | Node | Asignaciones observadas | Rangos nativos retenidos |
| --- | --- | ---: | ---: |
| Referencia anterior | 22.12.0 | 169 | 0 |
| Referencia anterior | 24.14.1 | 245 | 2 |
| Candidato con corrección del SDK | 22.12.0 | 245 | 0 |
| Candidato con corrección del SDK | 24.14.1 | 415 | 0 |

Los JSON conservan hashes de binarios y contadores de creación/liberación tras
cada ciclo. La referencia es el binario inmutable usado para checkpoint 66;
su implementación de rangos y del SDK no cambió entre su base y ese checkpoint.
El candidato es el WIP de `feature/native-attribute-copy`, `c51f9fb`, que ya
incluye un guard de ownership hasta que `napi_wrap` adopta el finalizador.

Este control amplía la reproducción previa de Attr a un consumidor existente.
La señal de dos rangos vivos después de finalizar todos los workers detecta
retención nativa fuera del GC; no se deduce de RSS ni de memoria del allocator.
Los callbacks de copia y el addon son reales, sin reemplazos ni mocks.

La planificación entre hilos no está forzada. Que una corrida libere todo no
demuestra ausencia universal de la carrera: Node 22 no reprodujo la fuga en la
referencia de esta tanda. El candidato también contiene cambios de atributos;
esta comparación todavía no aísla causalidad al parche del SDK. La siguiente
entrega debe separar esa corrección de las primitivas experimentales, construir
su propio binario, agregar la regresión y completar su validación antes del
checkpoint. No presentar el WIP como una corrección integrada en main.

El controlador XMLSerializer no construye estas instancias nativas y sus pruebas
focales no certifican la liberación de toda la plataforma. Esta incidencia sigue
pendiente del objetivo integral aunque pase la validación del controlador.

Para reproducir, usar un Node Linux y un addon real construido, indicando un
archivo de salida nuevo:

```sh
node reports/memory/native-class-construction/probe-range-copy.cjs \
  /ruta/al/runtime/dist/native.cjs /ruta/nueva/resultado.json
```

El probe guarda los fallos y preserva salidas existentes. Un exit code cero
significa que terminó la observación; consultar `balanced`, `final` y `cycles`
para determinar si la liberación estuvo equilibrada.
