# Recursos de la composición numérica

Node 22.12.0 y 24.14.1 ejecutaron el mismo ELF local
`a6a21c3c97f6972eb871be739fd4e4f9d7d4030156ab8062c69bab5a6d80c3b0`.
Cada SDK pasó seis ciclos de `range-state.json` y seis de `collapse.json`.
Los JSON son las salidas crudas; no se filtraron rondas de GC ni muestras adversas.

Range-State terminó con 4814 estados creados, 4814 liberados y cero vivos.
Incluye retención deliberada del estado nativo, Range/StaticRange retenidos
después del cierre, liberación final y slots débiles con un documento todavía vivo.
El probe de collapse conserva la retención deliberada, después observa por
separado Window, Document, Range y estado nativo hasta alcanzar baseline.
El contador de clases al baseline es 22; no se confunde ese baseline con cero.

Se guardan heap JavaScript, memoria externa y RSS como snapshots. No representan
memoria pico ni prueban ausencia universal de fugas. Los resultados de las demás
pruebas de recursos están íntegros dentro de los recibos de la suite en
`reports/validation/range-numeric-composed-candidate/local-linux/`.
