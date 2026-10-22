# Declaraciones heredadas: validación del esquema 2

Se agregaron 43 declaraciones del perfil observado: 32 de `EventEmitter`
expuestas por `VirtualConsole`, diez de la base de `CSSStyleSheet` y una de
`WindowProperties`. Las 4.331 entradas anteriores conservan sus registros;
531 fuentes y 7.246 anclas conservan exactamente sus bytes. El catálogo pasa a
4.374 APIs y registra cada ID nuevo en `reports/progress/inventory/denominator-v2.json`.
No acredita nuevas implementaciones Rust ni cierra el alcance global.

## Pruebas reales y procedencia

La validación final tiene once contratos por Node 22.12.0 y 24.14.1, sin fallos
ni exclusiones. Ejercen listeners/once reales, inserción/borrado CSS, propiedades
nominadas, deduplicación de ancestros, excepciones de auditoría, CLI en inglés
y turco, serialización determinista y liberación de Window/Document.

`native-final/` conserva resultados, comandos y las 206 fuentes verificadas de
la copia Linux. La referencia independiente sigue siendo jsdom 27.4.0, con el
digest de fuentes `6195104b9e153430a280485e51cbbbd738c73b9b1c7bc422a5df3d13a591fc5f`.
TypeScript 5.9.3 se reutiliza para el AST. Las dependencias de runtime se copiaron
del paquete oficial ya autenticado, sin cargar el addon de rustdom.

Las ejecuciones previas permanecen completas:

- Sobre NTFS montado en WSL, la versión inicial de nueve contratos dio ocho
  aprobados y un timeout del CLI en Node 22; Node 24 aprobó los nueve. Son los
  logs de este directorio y `processes.json`.
- `native/` aprobó los nueve contratos iniciales en ambos Node y generó los
  catálogos. Sus APIs y bases heredadas coinciden exactamente entre versiones.
- `native-final/` agrega las regresiones CSS y WindowProperties y aprueba once
  contratos por Node. Las dos copias Linux conservan sus fuentes originales;
  sus manifests describen los bytes de cada ejecución.

El timeout de 30 segundos se conservó. No se presentan las diferencias entre
filesystems como una optimización del código ni se oculta la ejecución fallida.
La enumeración observa descriptores sin ejecutar getters de las bases; sus
valores y algoritmos externos todavía requieren auditoría.

## Rendimiento y memoria

El [baseline nuevo del CLI](../../../benchmarks/migration-inventory/inherited-declarations/README.md)
conserva dos warmups y cinco muestras por Node, salidas verificadas y recursos
GNU time. El layout de I/O difiere del histórico; no es una comparación directa
ni rendimiento del DOM Rust.

Las [observaciones de memoria](../../../memory/migration-inventory/inherited-declarations/README.md)
conservan tres reportes JSON mientras observan por separado tres Window y tres
Document por Node. Terminan con dos estados claros consecutivos y sin esos
owners vivos. Son escenarios finitos del realm por defecto, sin garantía
universal ni medida de memoria pico del motor.
