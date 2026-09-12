# Variante aislada de FormData: archivo histórico

Este directorio preserva la variante de la tarea «Aplicar fix al comentario del PR», desarrollada sobre `eefde6320db875e53e71e07927c10077e4b1b60d` en la rama local `feature/formdata-realm`. No fue publicada. Su implementación y su validación corresponden exclusivamente al finding `3991528582`; **no validan la integración de los cinco findings**.

La integración actual conserva y adapta sus pruebas de comportamiento, su prueba de memoria con lecturas pendientes y el benchmark de formularios. Sus resultados propios están en [el informe integrado](../README.md) y en `../integrated.json`.

El ZIP `isolated-source.zip` contiene los 11 archivos de aquella variante. Se verificaron el SHA-256 del ZIP y el de cada entrada contra `source-manifest.json`, sin extraerlo ni instalarlo. [archive-verification.json](archive-verification.json) conserva esta verificación independiente. SHA-256: `c74065e3ef59c4a40dd0a9a740b5ee4ff94609b4cdc4b18c17fcfe7f3f73a5de`.

`variant-readme.md` se preserva tal como fue recibido, incluidos sus enlaces relativos al layout original. Los resultados históricos copiados fuera de este directorio son:

- [Benchmark corregido de la variante](../../../benchmarks/2026-09-12T15-20-46.843Z-formdata-fixed.json).
- [Memoria normal de la variante](../../../memory/2026-09-12T15-20-14.873Z-formdata-realm-normal.json).
- [Memoria VM de la variante](../../../memory/2026-09-12T15-20-14.873Z-formdata-realm-vm.json).

Estos archivos históricos permiten auditar la variante y su metodología; no sustituyen los gates ejecutados sobre el código finalmente integrado.
