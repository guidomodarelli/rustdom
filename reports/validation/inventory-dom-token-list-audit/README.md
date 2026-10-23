# Evidencia de correspondencia estática de DOMTokenList

El tar contiene32miembros regulares con fuentes locales/referencia, sus copias
oficiales correspondientes, cuatro archivos físicos construidos, tests existentes,
antecedentes históricos y el productor de esta auditoría. Todos los miembros se
releyeron y verificaron contra raw-files.json.

Los seis archivos locales coinciden con la preparación oficial39720077911;
los cuatro archivos construidos coinciden con su manifest B. El jsdom independiente
coincide con el catálogo27.4.0. No se ejecutaron producto, addon, suite, generador,
GC ni mediciones de rendimiento. La propuesta no cambia el ledger ni sus totales.
No confundir evidencia estática o logs históricos con validación funcional nueva.

`original-proposal.json` preserva la primera clasificación; el review posterior
acredita attrModified como dirty nativo con limpieza mecánica del wrapper.
El ledger conserva sus105filas y sus recuentos vigentes. Desde la raíz del repo,
`python reports/validation/inventory-dom-token-list-audit/verify-static.py`
comprueba IDs, alcance propuesto/diferido, recuentos y el archivo de fuentes.
Esa verificación de artefactos no sustituye las suites Node22/24 pendientes.
