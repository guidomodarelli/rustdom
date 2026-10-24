# CI general aprobado sobre 429b9240

El [run 39721714768](https://github.com/guidomodarelli/rustdom/actions/runs/39721714768)
terminó con éxito sobre `429b924026d857fabf15d9b2ae1c96deb2a1154a`.
Sus ocho checks aprobaron: validación Windows, Linux y macOS, cuatro shards de
benchmarks y agregador. Windows completó también las pruebas de instalación de
paquetes. `run.json` y `jobs.json` conservan la respuesta oficial completa.

`windows-job.log.gz` y `linux-job.log.gz` conservan los logs oficiales completos
de esos jobs. `files.json` fija las huellas de los cuatro archivos de evidencia.
No se ejecutó aquí una nueva suite ni se reconstruyó o midió otro candidato.

Este resultado acredita el CI general de ese SHA. XML y preparación tienen sus
checks separados; el gate histórico de ownership conserva su rechazo del estudio
anterior. La secuencia hosted `39721610003` se evalúa por separado y este recibo
no concede aceptación de su presupuesto ni autorización de merge/checkpoint.
