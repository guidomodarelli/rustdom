# Calificación del paquete hospedado numérico

`qa.json` resume la evidencia, no decide rendimiento. Artefacto12628261403 del
run40268999071, intento1, head2a53f88c, ELFa2777cbf. Se copió su distribución
exacta de575archivos con controles inmutables y344inputs canónicos, sin
recompilar Rust ni instalar dependencias. El snapshot de fuente conserva sus
errores Git reales; no se presenta como checkout del compilador hospedado.

El tar7339056bytes, SHA`fb06276a9fb0510360b4a0cf804699b2554303c3f80cf164fcd60f3f443aa72d`,
contiene7819miembros bajo raíz,7820con ella yseis enlaces internos. El manifiesto
externo conserva6987archivos físicos y69926755bytes físicos. Los lectores
actuales están en `reports/benchmarks/native-class-ownership/numeric-composed-packages/`;
los archivos `.py.txt` aquí son fuentes registradas, **no ejecutarlas**.

Pasaron12contratos de ensamblado, cinco de transporte Linux y tres Windows;
dos omisiones Windows corresponden a extracción de enlaces Linux. La extracción
real completa pasó también los probes autenticados Node22.12.0 y24.14.1: seis
ciclos por SDK, con Window/Document separados. Los logs de recursos se conservan
también en `reports/memory/range-numeric-composed-package/20261026/`.

La revisión detectó dos P2 corregidos: el cierre transitivo se autentica desde
Python antes de los verificadores Node, y el probe autentica el ensamble completo
antes de cargar el candidato. El negativo sustituyó el ELF por el local a6a21,
API-compatible: el guard lo rechazó con exit1. El driver esperaba por error
candidate/dist/rustdom.node, mientras el error real era dist/rustdom.node.
Se preserva ese fallo de matcher y se valida la evidencia guardada por lectura;
no se repitió esa ejecución. El probe inicial previo al guard también queda
separado, sin atribuirle las garantías añadidas posteriormente.

`runtimeExecuted=false` en los recibos de ensamble/archivo describe esas
operaciones de transporte; los probes de calificación sí ejecutaron el runtime
y lo declaran en sus reportes. No hubo captura científica, rendimiento aceptado,
reevaluación del gate, tag ni merge. El constructor StaticRange sigue JavaScript;
producción permanece híbrida. Las suites completas anteriores del CI siguen
siendo evidencia distinta de estos probes de paquete y mantienen sus exclusiones.
