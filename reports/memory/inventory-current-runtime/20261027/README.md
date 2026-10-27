# Recursos de tokens y dataset con Range integrado

Los cuatro reportes conservan las observaciones completas de los helpers de
DOMTokenList y DOMStringMap en Node 22.12.0 y 24.14.1. Se ejercitó el addon
local a6a21c3c del runtime integrado mediante la distribución real, desde las
pruebas de la propuesta de inventario a89ce898. Todos devolvieron `pass=true`.

Se conservan ciclos, Window, Document, nodos y wrappers separados, retención
deliberada cuando corresponde y liberación posterior, junto con RSS, heap y
memoria externa. Los datos provienen de pruebas finitas; no representan
memoria pico ni garantizan ausencia universal de fugas. El contexto completo
está en `reports/validation/inventory-current-runtime/20261027/`.
