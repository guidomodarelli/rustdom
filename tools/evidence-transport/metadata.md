# Publicación acotada de HANDOFF

`metadata.py` agrega una sección después del título de
`reports/progress/HANDOFF.md`. Conserva exactamente los bytes del título y del
cuerpo anterior. Es una extensión separada: no modifica el recolector, sus
doce dependencias fijadas ni el método científico que está ejecutándose.

El llamador debe autenticar `constants/metadata-reader.lock.json`, sus dos
archivos y el lock del runtime antes de compilar el módulo. También debe
proporcionar el parent remoto exacto, el OID Git y SHA256 del documento anterior,
sus bytes obtenidos independientemente, la sección nueva, el autor existente
y la credencial actual en memoria. No persistir la credencial.

La operación verifica la identidad del documento con Git, sin descargar su
blob previo. Reconstruye solamente sus árboles antecesores y exige un único
diff `M`. Deshabilita la hidratación en el escritor temporal; el único blob
permitido es el nuevo documento, de hasta 1 MiB. Un segundo clon independiente
lee y autentica el nuevo documento después del push. Solo entonces pueden
retirarse ambos clones propios. Los fallos conservan los objetos e intenciones
no confirmados; no hay reintento automático, force-push ni limpieza compartida.

Las pruebas de contrato se ejecutan con los bytes reales seleccionados:

```sh
python3 -B tools/evidence-transport/metadata.spec.py \
  --lock-sha256 <SHA256-revisado-del-lock> --original <HANDOFF-original>
```

La calificación integrada usa Git y GitHub reales en clientes aislados. Sus
comandos, resultados y driver se conservan en
`reports/validation/bounded-handoff/20261027/`. Los archivos allí archivados son
evidencia, no una fuente de código para ejecutar. Los tamaños de repositorios
son snapshots de almacenamiento; no son mediciones de memoria pico. Esta
herramienta no ejecuta DOM ni acepta rendimiento Rust.
