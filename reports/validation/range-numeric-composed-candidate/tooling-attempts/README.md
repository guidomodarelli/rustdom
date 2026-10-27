# Intentos funcionales preservados

Estos datos pertenecen a builds y pruebas de herramientas, no a un nuevo estudio
de aceptación. `performanceAccepted=null` y `gateReevaluated=false` en los tres.
El manifiesto autentica bytes almacenados y, cuando hay gzip, también bytes y
SHA-256 originales. No ejecutar scripts o código de estos archivos de evidencia.

- `factory-missing-fixtures`: el preparador aplicó correctamente los tres cambios
  y compiló el addon. Compatibilidad falló por `ENOENT`: el clon del contrato
  omitía fixtures históricos de WPT. El resultado `qualified=false` se conserva.
- `factory-fixtures-corrected`: el clon incluyó esos fixtures. Los cinco
  contratos de preparación y los 18 comandos completos en Node 24 terminaron
  en cero, incluidos compatibilidad, runners, corpus, WPT y memoria.
- `composed-output-collision-cancelled`: una revisión aislada detectó una salida
  de memoria exclusiva reutilizada por varias suites. Después de compilar y
  pasar la API/tipos se detuvo únicamente el grupo del comando funcional propio.
  `test:compat` conserva exit −15 y `qualified=false`; no fue un timeout ni
  una captura de rendimiento cancelada. La inspección posterior no encontró
  procesos con el entorno exclusivo de esa fuente.

El fix separa la evidencia de collapse en un probe con logs propios después
de las suites. `composed-qualification.json` solo puede aprobar si las suites,
la evidencia de memoria, hashes y procedencia final están completos. Se agregó
una regresión real con un destino heredado preexistente que debe conservarse.
Las nuevas calificaciones se conservan por separado; no se sobrescriben estos
intentos fallidos ni se usan para aceptar rendimiento.
