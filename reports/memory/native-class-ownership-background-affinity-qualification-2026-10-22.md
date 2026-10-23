# Memoria de la calificación de afinidad auxiliar

Los80workers completos de QA observaron960Window y960Document, incluidos240owners
de warmup de cada tipo. Son40procesos por Node22.12.0/24.14.1, cinco copias reales
y ocho cargas. Cada proceso verificó los últimos dos endpoints claros de tres
rondas; Rust volvió al baseline nativo antes de salir. El intento interrumpido
no se suma a estas cantidades y se conserva por separado.

Se guardan trazas, hashes públicos y afinidades, con todos los bytes originales
en el tar de calificación. No se midió aquí pendiente de crecimiento dentro de un
proceso, memoria pico ni fuga universal. Las afinidades observadas no garantizan
aislamiento físico ni visibilidad de hilos transitorios. Estos datos son QA
funcional; no aprueban rendimiento ni agregan implementación Rust.
