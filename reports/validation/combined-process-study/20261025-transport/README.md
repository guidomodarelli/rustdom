# Lectura y recuperación del transporte combinado

Sobre Git Linux real en HEAD `9b31d4cc` con cambios propios explícitos se
reprodujeron los 13 comandos del workflow: 29 contratos Node y 14 de transporte
en cada SDK oficial 22.12.0/24.14.1, con 714 dependencias y los 599 pins históricos
conservados. `summary.json` fija comandos, hashes de SDK, resultados y cada miembro
del ZIP de QA; `qa.zip` preserva 123 miembros de los intentos, incluidos los
fallidos. No ejecutar código archivado.

El primer checkout acotado omitía la configuración que el lector histórico
actual consulta al cargar. La dependencia ahora está incluida y fijada por SHA.
La revisión local detectó un TAR truncado que bloqueaba las siguientes lecturas;
se conserva y reconstruye únicamente su transporte, con regresiones para pins
completos y para la primera colección sin pins TAR. Un TAR correcto se reutiliza.

Los contratos leen el archivo real del run 40137458635: 19.214 miembros,
16.203 archivos regulares, seis enlaces y 1.404.005.115 bytes regulares. Comparan
el manifiesto completo con el original fijado. Ese run conserva `failure`; no
se vuelven a calcular sus criterios ni se cambia su rechazo. Se rechazan cambios
de run/job/commit/intento/workflow/artifact, alteraciones binarias, alias y salidas
ajenas; se preservan observaciones y parciales. Nunca se ejecuta DOM ni scripts
recuperados. Los bindings históricos no pueden pasar por el método combinado.

Durante la primera extracción local Ubuntu-22.04 sufrió errores E/S y montó su
disco en solo lectura; el reinicio no lo recuperó. El disco original se conserva
sin reparación destructiva. La validación final usa la distribución aislada
Rustdom-Validation-20261025, con imagen oficial y SHA registrados en summary.
Los logs de kernel, procesos y montajes se conservaron en QA. No se atribuye el
fallo de infraestructura al DOM ni se presenta el intento interrumpido como verde.

El estudio nuevo sigue deshabilitado. Faltan su recibo completo de activación,
decisión científica ligada al transporte y CI del SHA habilitado. Todos estos
resultados conservan `performanceAccepted=null`, `gateReevaluated=false`; no son
aceptación ni habilitan tag/merge de ownership. El runtime sigue híbrido.
