# Validación de tracing nativo antes de la captura

Node22.12.0/24.14.1, WSL local. La captura prospectiva de diez procesos aún no
se ejecutó. El método se declara en
`reports/benchmarks/native-class-ownership/compilation-diagnostics/PROTOCOL.md`.

Los dos probes CLI numéricos verifican ejecución real con checksum y emisión
de eventos de compilación, optimización y fondo. No son tests DOM ni benchmarks
del producto. Luego, los contratos reales ejecutaron J0/A0, ocho cargas por
proceso, en ambos Node: cuatro procesos funcionales, 32 outputs iguales al
archivo original y 384 spans. La identidad completa de la preparación oficial
se verificó antes y después en ambos Node, sin reconstrucción.

Se capturaron 510.536 eventos completos de la categoría de compilación durante
estos contratos; no son 510.536 compilaciones. Se conservan nombres y distinción
de hilo principal/fondo. Los demás eventos, fases y metadata están en los crudos.
Los timestamps nativos abarcan los spans y las nueve duraciones medidas son
exactamente las de esos spans. No se acepta un presupuesto ni se atribuye una
operación a una función por proximidad temporal.

El tar conserva las tres fuentes del método, los dos probes, los cuatro workers,
traces nativos completos, spans, GC, memoria, stdout/stderr, comandos, hashes,
manifest y las 390 partes de la copia instrumentada reutilizada. La cuenta
390 incluye 387 fuentes del arnés más el wrapper, manifest y patch; no son
390 módulos nuevos de producto. Tamaño y SHA-256 en `receipt.json`.

La copia instrumentada no cambió: los bytes coinciden con el método `8c6dc74b`
y su validación de 32 cargas y regresión real de GC al fallar. Se reutiliza esa
evidencia del wrapper; los nuevos contratos ejercen el CLI de tracing real.
La preparación de paquetes se referencia por identidad y por el ZIP oficial
ya versionado del run39720077911, artefacto12400802735; no se reemplaza por CI nuevo.

Las suites amplias de Rust/Jest/Vitest/corpus no se volvieron a ejecutar para
este cambio de herramientas: no cambia código de producto, los contratos
anteriores siguen disponibles y el CI general de8c6dc74b aprobó ocho checks.
Los checks del SHA que publique este método se siguen por separado.
