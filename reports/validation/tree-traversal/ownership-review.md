# Revisión de ownership de los recorridos

Alcance: cambios no commiteados de feature/native-tree-traversal sobre 82efd905,
con referencias remotas actualizadas. Se revisaron el cursor puro, binding N-API,
adapter de wrappers, integración de construcción y controles de memoria.

- Cursor conserva root/current numéricos, máscara y flags; no contiene napi::Ref,
  callbacks ni punteros a wrappers. Su token de forest es Weak, por lo que no
  mantiene viva la tabla de nodos.
- La operación conserva la fase y el candidato numérico. El token débil de cursor
  impide mezclar operaciones de distintas instancias; no mantiene vivo el cursor.
- El host conserva root/currentOwner y resuelve candidatos mediante el registro
  existente. El candidato permanece accesible durante callback y conversión.
- No se ejecuta JavaScript bajo el préstamo de TreeStore, Cursor u Operation.
  Las mutaciones reentrantes se observan al reanudar el recorrido nativo.
- finally limpia el flag activo aun cuando el callback lanza. La conversión ocurre
  después y puede reentrar. Una operación abandonada es recolectada por V8; Drop
  actualiza su contador nativo. Los tests verifican liberación también al lanzar.
- La reparación de NodeIterator sucede antes del unlink del árbol y actualiza
  tanto la posición nativa como el owner JavaScript. Mantener un cursor conserva
  sus nodos; soltarlo permite recolectar nodos, filtro, Document y Window.

No se encontraron ciclos fuertes ocultos ni almacenamiento acumulativo en los
nuevos controladores. Los ocho ciclos focales de GC pasaron; los controles generales
y Memcheck se registran por separado. Las pruebas finitas no demuestran ausencia
absoluta de fugas ni cubren toda la plataforma DOM pendiente de migración.
