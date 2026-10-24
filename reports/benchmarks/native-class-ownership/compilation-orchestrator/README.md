# Secuencia nativa preparada y probada

El orquestador utiliza el constructor de comandos ejercido por 32 cargas reales
y 384 spans en ambos Node. Seis contratos por Node verifican byte identity,
tratamientos y conservación de fallos con procesos reales, sin mocks.

Estos son contratos funcionales: no se incorporan a la captura prospectiva de
diez procesos y no resuelven el rechazo de rendimiento. Las fuentes, trazas,
comandos y snapshots están en
`reports/validation/native-class-ownership/compilation-orchestrator/`.
La captura completa todavía no se ejecutó; primero se publica y coteja el método.
