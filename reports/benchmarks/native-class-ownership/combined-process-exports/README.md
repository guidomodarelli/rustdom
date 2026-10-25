# Exportación de recursos sin nuevas mediciones

Este lector opera fuera del método congelado del run40184510898. No modifica sus
723 dependencias, recibo, paquete, plan, estimador ni presupuestos. Autentica el
recibo independiente y reutiliza cinco helpers actuales fijados por SHA256 para
el predicado de liberación, agregación y formato; nunca invoca sus decisiones
históricas ni importa implementaciones desde una captura.

Operaciones:

```sh
node resources.cjs --functional <datos-originales-64> <destino-nuevo>
node resources.cjs --capture <extraccion-autenticada/capture> <destino-nuevo>
```

El modo funcional admite solo el index original fijado y sus 64 procesos; no los
presenta como 2048 ni permite que pasen el modo científico. El segundo modo exige
el payload científico completo con el verificador actual. La autenticación
externa del ZIP/TAR y decisión pertenecen a decision.cjs; este exportador siempre
mantiene captureAuthenticated=false, performanceAccepted=null y gateReevaluated=false.

spans.csv conserva warmup y duraciones medidas, identidad original, fila, tamaño
y cantidad de iteraciones. resources-native.jsonl conserva por proceso todos los
baselines nativos, propietarios Window/Document separados, endpoints de memoria
y las tres rondas de limpieza completas, sin seleccionar familias de contadores.
memory.json conserva totales, grupos por paquete físico y por fila, snapshots
originales del padre y procedencia real del lector. Los rangos son observaciones
de cleanup; no representan memoria pico ni causalidad entre paquetes.

Las pruebas usan los 64 procesos ya archivados: no ejecutan DOM ni añaden muestras.
Conservan los ocho primeros estados no claros y rechazan Document retenido,
baseline alterado, salidas existentes y alias hacia datos originales. El caso de
escritura fallida impone RLIMIT_FSIZE real en un hijo Linux, sin mocks: ocho
errores EFBIG deben preservar parciales y cerrar ambos escritores. Las pruebas
finitas no garantizan ausencia universal de fugas.

El CI propio tiene un catálogo superset separado y verifica ambos Node oficiales.
No regenera ni cambia el catálogo del experimento activo. No autoriza reaplicar
su etiqueta, repetir su secuencia ni aprobar rendimiento con fixtures funcionales.
