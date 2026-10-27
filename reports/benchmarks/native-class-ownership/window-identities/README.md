# Identidades de funciones en Windows nuevos

Observación sin temporizadores sobre jsdom 27.4.0 de la preparación oficial.
El probe construye doce Windows sucesivos, crea y clona Range, colapsa el
clon y verifica texto y comparación de límites. Registra identidades de
funciones con WeakMap y conserva solo IDs escalares y WeakRefs de owners.
Cada Window se cierra; hay tres rondas de cleanup y se exigen los últimos
dos endpoints claros para Window y Document por separado.

El resultado describe identidades públicas. Funciones distintas pueden
compartir código compilado o feedback; estos IDs no identifican tiers,
SharedFunctionInfo, optimizaciones, deoptimizaciones ni CPU consumida.
No prueban la causa de la variación del estudio de Azure ni justifican
aumentar warmups o cambiar límites. No se recogen duraciones ni se acepta
rendimiento. La observación de Object compartido tampoco prueba que exista
un isolate nuevo por Window.

La prueba usa el paquete jsdom real, sin mocks, caches fuertes de funciones
ni modificaciones de sus bibliotecas. Sus resultados no prueban ausencia
universal de fugas y no migran código DOM a Rust.
