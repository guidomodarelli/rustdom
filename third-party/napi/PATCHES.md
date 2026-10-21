# Parche local sobre napi 3.12.3

Fuente: https://crates.io/api/v1/crates/napi/3.12.3/download

SHA-256 del archivo original:
`2862d9586f6afe036f7f7fd03d017d3c11d948a4e34702c212dd9ef62ed98b58`.
La copia descargada coincide con el source cache utilizado por el proyecto.

`class-reference-cleanup.patch` registra un cleanup por cada registro de módulo
en targets Node nativos con N-API 3 o superior. Ese cleanup elimina sus propias
referencias de constructores del mapa y llama napi_delete_reference antes de
destruir el env. La identidad de cada referencia protege registros posteriores
en el mismo thread. Si falla registrar el hook, se devuelve la propiedad de las
referencias inmediatamente. Se exponen contadores Rust de diagnóstico para
comprobar creación, liberación y errores al cerrar workers.

El cambio corrige las referencias user-owned creadas por el registro de clases;
no suprime pérdidas ni cambia la lógica de los objetos DOM. También se agrega
metadata de procedencia/licencias en Cargo.toml para incluir este aviso y el
parche junto al binario distribuido.

La crate declara MIT pero no incluía el texto de licencia. LICENSE se obtuvo
del commit indicado por .cargo_vcs_info.json:
https://raw.githubusercontent.com/napi-rs/napi-rs/31c27a1676a7c4b317f4e144e0a9cb94e8354143/LICENSE
Git blob SHA: 7fe7e35eff46457f65a4e30a717fada632de9e03.

## Ownership durante creación de instancias

`new_instance<T>` conserva la propiedad de la asignación hasta que
`new_instance_raw` registra el finalizador mediante `napi_wrap`. Un error
anterior libera el valor Rust; un error posterior al wrap, incluido el tag de
tipo, deja la liberación al finalizador de JavaScript. El guard distingue
`Box<T>` de los placeholders de un byte que genera el SDK para ciertas clases
de tamaño cero. Los callbacks de referencias se asignan después de un wrap
correcto y la bandera de fábrica recupera su valor anterior también al fallar.

La regresión usa un worker real terminado durante la preparación de una copia
de Attr de 4 MiB. El camino anterior dejaba el payload Rust vivo sin wrapper y
sin bytes externos contabilizados. Se compara el binario anterior y el
corregido en Node 22 y 24; los tests mantienen ocho ciclos por runtime.
Seis tests Rust ejercen el guard real, su transferencia de ownership y ambos
layouts de clases de tamaño cero, también bajo Memcheck.
