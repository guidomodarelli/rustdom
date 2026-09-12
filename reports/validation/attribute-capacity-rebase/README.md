# Validación de la unión final del PR

El fix de capacidad se rebasó sin conflictos sobre `a8c2c18d3177ac2b57c3dbb12e5fafee90761535`, que incluye los cambios de Unicode y activación de handles. El commit de implementación resultante es `b6ef15558e4e8b804808e9d00baa828e0a8f6c1c`. El manifiesto de seis archivos propios en `latest.json` confirmó hashes idénticos antes y después del rebase.

El drift se clasificó como `REMOTE_DRIFT_RELATED`: cambian inicialización, consultas, serialización y build/package, aunque no hay solape textual con los índices de atributos. Se ejecutaron nuevamente formato, Clippy, los 38 tests Rust, build release, todos los 173 tests Node24 (incluyendo Unicode desconocido/ausente y activación), seis tests focales de atributos en Node22 y el estrés de memoria con documento/elemento vivos. Todos pasaron.

Se reutilizaron el validate completo del candidato aislado (`attribute-capacity-final/`), su benchmark y las validaciones específicas de Unicode/activación de los commits integrados. No se presenta como reejecución de Jest, Vitest, corpus HTML5, WPT ni del empaquetado en este rebase: las superficies nuevas quedan cubiertas por sus matrices previas y las pruebas de integración aquí ejecutadas. La CI del PR comprueba nuevamente el árbol final en las plataformas configuradas.

El reporte de memoria de la unión es `reports/memory/2026-09-12T03-05-05.453Z-attribute-capacity.json`: ambos motores pasaron; en rustdom los 10.240 Attr temporales observados se recolectaron antes del cierre y luego también Document, Window y el alias. Los contadores nativos permanecieron en su baseline; el heap usado creció 157.216 bytes y el RSS 1.650.688 bytes después del warmup. Son observaciones finitas y no una prueba de ausencia absoluta de fugas.

Los logs se guardan normalizados a LF; los resultados y muestras JSON permanecen completos. El commit posterior agrega esta evidencia y la nota de seguimiento de `TreeStore`, sin modificar la implementación medida.
