# Plan de preparación y ejecución

Examen: 2026-11-21, 19:00–22:50 America/Lima. Límite: 230 minutos.
El problema aún es desconocido. El stack es una elección inicial, sujeta al enunciado y la rúbrica.

## Etapas de preparación

1. Diagnóstico — COMPLETADO. Aplicación y configuración en la raíz de DevOps-Examen; sin template/, projects/<nombre> ni inicializador. Evidencia y límites en PREFLIGHT.md.
2. Resolver bloqueos locales — CONFIRMADO POR EL USUARIO: npm ci, npm run check y npm audit --audit-level=high finalizaron correctamente. Node → Neon con TLS/SELECT 1 y herramientas externas confirmados previamente; no repetir diagnósticos.
3. Base local — PREPARADA EN LA RAÍZ. Next.js/TypeScript, pg sin ORM, controles de calidad y cinco workflows en .github/workflows/. Conservar package-lock.json y configuración existente; no crear scripts ni otra estructura.
4. Ensayo — RESULTADOS REPORTADOS POR EL USUARIO: CI y dependencias/secretos aprobados en el repositorio de ensayo; Vercel desplegado correctamente; ZAP ejecutado con 11 categorías de advertencias pendientes de revisión. CodeQL no pudo ejecutarse por falta de Code Scanning en el repositorio privado. No considerar el ensayo completamente aprobado ni extender sus permisos a otros destinos.
5. Congelar preparación — PENDIENTE DE CIERRE. Revisar hallazgos ZAP y resolver o registrar la limitación de CodeQL según la rúbrica. Conservar comandos comprobados y alternativas; no actualizar versiones al empezar el examen.

Cada etapa requiere autorización antes de pasar a ella. Las autorizaciones locales no implican autorización para crear o modificar recursos remotos.

## Prioridad de configuraciones

| Prioridad | Pendiente | Criterio comprobable |
| --- | --- | --- |
| P0 | CMD/red/autenticación | Confirmados manualmente; no repetir |
| P0 | Node → Neon | Confirmado manualmente con TLS/SELECT 1; no repetir |
| P0 | Alcance del examen y destinos | Rúbrica disponible al inicio; repositorio, proyecto Jira y despliegue autorizados antes de escribir remotamente |
| P1 | Acceso GitHub MCP y Actions | CI y dependencias/secretos aprobados en ensayo; acceso MCP y permisos del destino definitivo pendientes |
| P0 | Reproducibilidad | npm ci, npm run check y npm audit --audit-level=high confirmados correctos; conservar lockfile/.npmrc, sin repetir ahora |
| P1 | DevSecOps | CodeQL bloqueado por falta de Code Scanning en el repositorio privado; revisar las 11 categorías de advertencias ZAP según la rúbrica |
| P2 | Docker | Motor accesible y contenedores Linux comprobados si se necesita ZAP u otro servicio; omitir si no aporta valor |

## Ejecución del examen: presupuesto de 230 minutos

| Hora Lima | Minutos | Resultado esperado |
| --- | ---: | --- |
| 19:00–19:15 | 15 | Leer rúbrica, aclarar aceptación, elegir MVP y registrar restricciones |
| 19:15–19:35 | 20 | Backlog pequeño, tareas Jira, modelo de datos y arranque del proyecto; recursos remotos solo autorizados |
| 19:35–20:55 | 80 | Implementar una funcionalidad completa extremo a extremo y luego ampliar según prioridad |
| 20:55–21:30 | 35 | Pruebas de lógica/validación y errores relevantes; lint y build, corregir fallos |
| 21:30–22:00 | 30 | CI, CodeQL y revisión de secretos/configuración; registrar resultados reales y limitaciones |
| 22:00–22:25 | 25 | Despliegue autorizado, smoke test con BD y ZAP de alcance autorizado |
| 22:25–22:50 | 25 | Evidencias, README, estado Jira, revisión de aceptación y entrega; margen para corregir |

Hacer un primer despliegue y encender CI antes si ya existe un flujo mínimo funcional y autorización; no esperar al último tramo para descubrir problemas de plataforma. Reasignar tiempo según la rúbrica conservando el cierre de 25 minutos.

## Decisiones mínimas para el enunciado

- Next.js/TypeScript con una sola aplicación. Añadir abstracciones y dependencias solo por una necesidad concreta.
- PostgreSQL en Neon mediante pg, sin ORM; esquema mínimo, validación y consultas parametrizadas cuando se autorice implementar. En la preparación actual solo se permite SELECT 1 con TLS y certificado validado.
- Vitest para comportamiento importante; ESLint y build como controles locales. No perseguir cobertura arbitraria.
- GitHub Actions con permisos mínimos y secretos del servicio; CodeQL y ZAP como verificaciones distintas, con evidencia de su ejecución cuando se soliciten.
- Jira con pocas tareas trazables a criterios de aceptación y commits/PR si aplica. Evitar burocracia que reduzca implementación.
- Docker cuando simplifique una necesidad concreta o lo exija la rúbrica; no es requisito para arrancar el desarrollo con Neon.

## Contingencias

- Si el sandbox bloquea un comando, usar CMD externo del usuario para ejecutarlo y registrar su salida saneada. No marcarlo verificado antes de recibir evidencia.
- Si MCP GitHub no muestra repositorios, validar acceso mediante CLI/web; no asumir que el conector tiene permisos por reconocer la cuenta.
- Si Neon no está disponible, trabajar con contrato de datos y fixtures solo como simulación explícita. La aceptación con BD queda pendiente hasta una conexión real.
- CodeQL está bloqueado por falta de Code Scanning en el repositorio privado del ensayo. Si es obligatorio, acordar un destino con disponibilidad y permisos o una alternativa aceptada por la rúbrica; no cambiar visibilidad, licencia ni configuración sin autorización. ZAP sí se ejecutó: revisar sus 11 categorías de advertencias antes de declarar resueltos los hallazgos.
- Si falta tiempo, recortar funcionalidades secundarias y conservar un flujo funcional, pruebas críticas y entrega verificable.

## Próximo paso propuesto

Revisar evidencia saneada de las 11 categorías de advertencias ZAP y determinar cómo cubrir CodeQL según la rúbrica. Las validaciones locales, CI y dependencias/secretos del ensayo y el despliegue Vercel ya fueron reportados; no repetirlos en esta actualización documental.

Comando de referencia para una futura revalidación autorizada desde CMD externo, en la raíz de DevOps-Examen: `npm ci && npm run check && npm audit --audit-level=high`. No requiere cambiar de carpeta. La ruta del verificador PostgreSQL es scripts/check-db.mjs; no cargar credenciales ni repetir la conexión SQL ahora.

Esta tarea solo actualiza AGENTS.md, docs/PREFLIGHT.md y docs/PLAN.md. No modifica código, dependencias, workflows o configuraciones; no crea scripts ni ejecuta red o despliegues. Esperar el enunciado y la autorización aplicable antes de implementar o realizar nuevas operaciones remotas.
