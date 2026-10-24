# Evidencia de la base anterior al parche

Este ZIP conserva el último control del PR 79 sobre
`a424bdd7be36af6c894b75c6579dbe3520348b78`, integrado mediante squash en
`3d37f89976a48203e80cc5c435e099267f4ce346`,
`checkpoint-067-xml-serializer-controller`.

El [run 39620695115](https://github.com/guidomodarelli/rustdom/actions/runs/39620695115)
verificó 468 procesos del controlador XML. `verification.json` contiene el
recálculo de las salidas y `provenance.json` identifica head, fuentes y artefacto
12355394154. El SHA-256 del ZIP es
`cf2f7002933428b3cc486600058571e0ed0af242d016af7dc627c7d17ebf713f`.
Su merge temporal `391899248c5bf7a8e1556ccc5b49867f68d5b2db` comparte el árbol
`9175f0953aba0ad4259bce6d81042dca3783f1bf` con el head revisado y el squash.

Es evidencia de la base sin el parche de ownership. Los benchmarks de este hito
usan un protocolo separado y no atribuyen estas mediciones al SDK corregido.
La evidencia primaria del primer run aceptado permanece en
`reports/benchmarks/xml-serializer-controller/hosted/39613158016/`.
