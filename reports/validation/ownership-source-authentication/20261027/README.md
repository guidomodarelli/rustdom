# Validación de autenticación histórica y equivalencia de producción

Se ejecutaron los SDK fijados 22.12.0/24.14.1, autenticados por SHA-256, con
26 contratos Node y tres Python aprobados por SDK. Los recibos, streams y
fuentes están dentro del archivo íntegro del benchmark asociado. No se
usaron mocks de plataforma. El paquete original no se recompiló ni sustituyó.

La revisión local aislada cerró dos hallazgos: aceptar configuraciones de build
opcionales no declaradas, y omitir `npm-shrinkwrap.json` de ese borde. El
contrato final usa siete archivos reales y un enlace colgante. Hashes revisados:

- Guard `production.cjs`: `1db3e5f2cf234f84a911c26d6c4fca0b6d4579e7485cc7b10979883076224c4b`.
- Política: `efe92e33136aa151de76ddad1dea3d4c34cc63be68a513a9efa002cdaa9d0872`.
- Tests: `53a914ee3e3df797adc81a478d64eee570e47d2a105c41bfa8017f5f867dad6f`.

`production-before-integration.json` conserva los 344 resultados y las cuatro
diferencias reales. La equivalencia de fuentes no autentica configuración
global, entorno de build, Git o un binario recién construido. El guard no
aprueba rendimiento. La confirmación científica continúa deshabilitada.

`checks-54831a7e.json` registra 81 checks aprobados y dos rechazados en el SHA
anterior. `hosted-functional-54831a7e.json` confirma los cuatro jobs funcionales
aprobados de ese SHA. Estos resultados hospedados no validan el adaptador
nuevo: su CI se consulta después de publicar este incremento. Los dos rojos
siguen siendo el rechazo de rendimiento de 39921160254, no un fallo nuevo de
compilación. No se resolvió todavía el gate ni se permite tag/merge.
