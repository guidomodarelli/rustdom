# Revisión de ownership y recursos

Alcance: código propio de rustdom, puente Node-API y ciclo de vida de los entornos. La primera revisión incluye todos los archivos nuevos del repositorio. No es una auditoría completa de dependencias.

## Riesgos corregidos

1. **Retención de una ventana cerrada por el callback de teardown de Vitest.** El callback conservaba `dom`; ahora libera esa referencia y la función de reenvío de errores después del cierre. Las colecciones auxiliares de keys y descriptores también se vacían.
2. **Pérdida de globals anteriores.** `populateGlobal` reemplaza aliases de ventana sin guardar todos sus descriptores. El adaptador conserva y restaura esos aliases explícitamente.
3. **Inicialización parcial.** Un global `document` o `jsdom` no configurable podía interrumpir setup después de instalar propiedades que retenían la ventana. La instalación ahora hace rollback completo y cierra la ventana al fallar.
4. **Errores de ventana que no llegaban al runner.** Se agregó reenvío de excepciones no atendidas y se retiran los handlers al terminar, respetando los handlers registrados por el test.

Estos cambios tienen pruebas de comportamiento de setup/teardown, timers, descriptores, excepciones y fallos parciales. La prueba de memoria conserva deliberadamente los callbacks de teardown para detectar retenciones accidentales.

## Ownership del parser

- Cada llamada crea un `RcDom` temporal. Las referencias a padres son débiles; el árbol, la lista de visitas y los eventos pertenecen a esa llamada.
- El recorrido de salida es iterativo. Un test con 10.000 niveles verifica el recorrido y la destrucción sobre entrada profunda.
- La interfaz Node-API transfiere strings y atributos. No crea `External`, referencias persistentes a objetos V8, threads ni callbacks JS por nodo.
- El estado persistente propio del puente consiste en contadores y un conjunto finito de motivos de compatibilidad; no almacena documentos ni HTML.
- Los nombres únicos del stress test ejercitan el internado dinámico de nombres. Los resultados del proceso nativo registran heap, memoria externa, buffers y RSS tras warmup y GC.

## Interpretación de resultados

Los JSON con fecha conservan las observaciones. El escenario inicial mide documentos; el ampliado también observa los documentos de iframes, deja observers conectados y usa nombres de atributos únicos. Cada target se ejecuta en un proceso nuevo para separar heaps y caches.

Una referencia débil que desaparece demuestra que ese documento puede recolectarse en el escenario medido. Una RSS estable es evidencia de ausencia de crecimiento retenido en esa carga, no una prueba de que cada allocation se haya devuelto al sistema operativo. Los allocators pueden conservar páginas libres.

No se ejecutaron ASan/LSan, Valgrind ni una campaña prolongada de fuzzing. Tampoco se verificó localmente el addon nativo de Windows o macOS. No se afirma ausencia absoluta de fugas fuera de los escenarios y límites guardados.
