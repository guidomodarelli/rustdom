# Correspondencia entre el candidato actual y el paquete medido

Antes de interpretar el ensayo prospectivo con GC previo, se contrastaron los
inputs de producción/build del commit7d5ada1f con las fuentes del paquete B de
la preparación oficial39720077911, artefacto12400802735. Los conjuntos contienen
los mismos284 archivos y todos sus SHA-256 coinciden. El alcance incluye todos
los archivos Git bajo `src/`, `scripts/`, `third-party/`, y `Cargo.toml`,
`Cargo.lock`, `build.rs`, `package.json`, `package-lock.json`. Se comprobaron
también los inputs adicionales/opcionales fijados por la receta histórica.

`correspondence.json` conserva cada ruta, ambos hashes, cobertura de conjuntos,
manifests de paquete/dependencias y procedencia del artefacto. La preparación
completa ya se autenticó antes de medir. El arnés de medición publicado en
a558e472 se autentica por separado:403 fuentes, SHA8798e3f0…; cambió su setup GC,
no esos inputs de runtime/build. No se consultaron tiempos parciales para esta
comparación ni se ejecutó otro worker, build, suite o captura.

Esto permite evaluar la aplicabilidad de evidencia sobre **ese paquete B** a
los mismos inputs de runtime. No demuestra equivalencia binaria con otro build,
compilador, flags, sistema o plataforma. Tampoco es auditoría de alcanzabilidad,
porcentaje de migración, compatibilidad completa ni prueba de rendimiento.

El gate actual sigue rechazado. Una evaluación posterior debe exigir el ensayo
completo y válido de ambos Node, las ocho cargas y límites originales, identidad
del arnés y preparación, hashes públicos, liberación de recursos y todos los
datos crudos. El alcance caliente debe mantenerse separado del arranque; las
suites completas de Jest/Vitest son evidencia distinta y deben conservar sus
propios inputs y decisiones. Esta correspondencia no reemplaza esas exigencias,
no aprueba tiempos ni relabela los rechazos anteriores.
