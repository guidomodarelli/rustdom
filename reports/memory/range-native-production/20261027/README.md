# Recursos de Range integrado

`endpoints.json` conserva seis ciclos por SDK fijado: 32 rangos y sus clones
por ciclo, retención explícita de un rango tras `close()` y liberación posterior.
Se observan Window, Document, rangos y estados nativos por separado. Los
supervivientes finales fueron cero y los contadores nativos volvieron al
baseline en todos los ciclos. Los baselines, rondas, RSS, heap y memoria
externa quedan conservados; no se infiere memoria pico ni ausencia universal
de fugas a partir de estas pruebas finitas.

`ntfs-partial/` contiene dos reportes producidos por la primera suite local
interrumpida por E/S; no se suman a la calificación final de Range. Los demás
recursos y todos los intentos están en el archivo de validación asociado.
El runtime sigue híbrido. Estos resultados no aceptan rendimiento.
