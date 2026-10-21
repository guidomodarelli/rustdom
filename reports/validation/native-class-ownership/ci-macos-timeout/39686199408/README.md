# Timeout macOS después del aislamiento

CI 39686199408/job119520759578, head `3d682ab477992381aba3bf1e4c98b55dbb01d826`, Node 24.21.0.
El ZIP oficial del artefacto 12387930088 coincidió con el digest publicado por GitHub;
se comprobaron todos los CRC. Se preserva el reporte WPT completo comprimido sin
modificar sus bytes y una extracción JSON de la única fixture divergente.

Range-mutations-dataChange.html produjo 2.808 resultados individuales idénticos,
todos aprobados. El estado global fue TIMEOUT (2) en jsdom y OK (0) en rustdom.
La referencia tardó 78.752,944708 ms y el candidato 17.699,825 ms. La fixture
declara timeout long y el harness upstream usa 60.000 ms. Los límites externos
eran 90.000/120.000 ms; ambos procesos terminaron con exit 0, sin señales.

El aislamiento por proceso no bastó. No se convierte este resultado en paridad
ni se ignora su estado global. La nueva política usa la extensión upstream de
runner `setup({timeout_multiplier:2})` para ambos motores, con límites externos
finitos y pruebas de timeout real. Requiere validación y CI macOS antes de
declarar resuelto el fallo. No afecta presupuestos de benchmarks ni mide una
mejora de rendimiento. Las memorias posteriores a close no incluyen GC y no
demuestran ausencia de fugas.
