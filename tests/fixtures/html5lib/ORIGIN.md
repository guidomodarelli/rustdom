# Origen del corpus

Repositorio: https://github.com/html5lib/html5lib-tests

Revisión: `9329e64694e7835d0dcff9811e22856ef6ad16f9`.

Se conserva `tree-construction/` y la licencia originales, extraídos mediante `git archive` sin conversión de finales de línea. Los casos actuales se mantienen en [Web Platform Tests](https://github.com/web-platform-tests/wpt/tree/master/html/syntax/parsing).

El runner de rustdom compara el resultado con **jsdom 27.4.0**; no compara los errores de parsing ni el árbol normativo `#document`. Por eso este resultado es una prueba diferencial de compatibilidad, no una certificación de conformidad HTML5 ni una ejecución completa de WPT. Los casos `#script-on` se contabilizan como excluidos; el resto se ejecuta con scripting deshabilitado. La ejecución de scripts se cubre por pruebas propias.

Se ejecutan los 57 archivos `.dat` de la raíz de `tree-construction/`. Los tres archivos de `scripted/` se conservan como parte de la copia original pero no se ejecutan ni integran el denominador de este informe.
