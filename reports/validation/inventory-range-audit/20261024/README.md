# Auditoría de Range

Se revisan tres módulos y 31 APIs de jsdom 27.4.0, sin agregar aprobaciones
Rust completas ni cambiar el denominador. Las clasificaciones propuestas están
en `reports/progress/inventory/range-audit-20261024/`. La auditoría se integró en el catálogo canónico con su contrato actualizado.
La premisa inicial sobre el congelamiento del test era incorrecta: su path no
está en los 563 pins. La lista exacta y los bytes congelados se comprobaron
antes de integrar. Ver reports/validation/inventory-range-integration/20261024/;
los catálogos y logs iniciales de qa.zip se conservan sin modificaciones.

La auditoría separa el estado y las decisiones Rust de los getters de identidad,
constructores, WebIDL, factories, drivers y efectos JavaScript. Los valores
constantes y símbolos de marca no se reclasifican aquí. Los miembros heredados
de AbstractRange no se cuentan de nuevo en Range o StaticRange.

La QA ejecuta los 13 archivos actuales de pruebas Range y un contrato público
adicional sobre constructores, identidad, receivers y detach. Cada Node fijado
pasa 70 contratos. El primer intento pasó 69 y falló por un helper ESM ausente
del directorio temporal; al copiar ese archivo actual, pasan los 70. Se guardan
ambos intentos sin cambiar el runtime, los fixtures ni las assertions.

El SUT es el paquete A0 ya preparado, autenticado contra su índice publicado,
y la referencia es jsdom 27.4.0 independiente. Las 20 fuentes de Range
inspeccionadas coinciden byte por byte entre la rama actual y las fuentes
del baseline. **Esto no califica el guard de ownership ni el candidato aislado**:
no se atribuye al binario A0 el HEAD de la rama actual. No se reconstruyen ni
reinstalan paquetes y no se ejecuta una captura de rendimiento.

Los siete contratos del catálogo canónico y el CLI real con --audits comprueban
la propuesta en Node 22.12.0/24.14.1. Los catálogos de cada Node coinciden entre
intentos; entre versiones solo difiere surface.json por la versión de Node
registrada en el perfil y sus globals ECMAScript excluidos. Se preservan todos
los catálogos, logs crudos y recibos en qa.zip;
summary.json contiene el manifiesto completo, los hashes y los recuentos.
El ZIP es evidencia de datos: no contiene scripts para ejecutar.

Para reproducir el catálogo propuesto desde la raíz del repositorio:

```sh
node scripts/migration-inventory.cjs --audits reports/progress/inventory/range-audit-20261024/merged-audits.json --output /salida-nueva
```

El contrato público adicional recibe rutas absolutas de paquetes instalados
reales mediante RUSTDOM_RANGE_INVENTORY_RUNTIME y
RUSTDOM_RANGE_INVENTORY_REFERENCE. Usar el mismo ejecutable Node fijado y
`node --test reports/validation/inventory-range-audit/20261024/tools/public-contracts.spec.cjs`.
Las suites existentes se ejecutaron desde un directorio separado con sus
helpers actuales y el dist A0 autenticado, preservando los paquetes preparados.

El recurso de memoria se documenta en
`reports/memory/inventory-range-audit-20261024.md`. No hay porcentaje defendible
mientras el alcance y los algoritmos semánticos permanezcan abiertos. El
candidato aislado de collapse no está integrado en el runtime publicado y no
se acredita a estos consumidores.
