# Estado actual — DevOps-Examen (2026-11-21)

Estado general: LISTO CON OBSERVACIONES. La base está preparada para recibir el enunciado. Quedan hallazgos ZAP por revisar y un bloqueo de CodeQL. Esta actualización es documental: no ejecuta validaciones locales ni remotas.

## Estructura actual

El contenido de la plantilla ya se copió a la raíz de DevOps-Examen. No existe ni debe crearse template/. No se usa projects/<nombre> ni un inicializador.

- app/: Next.js App Router, React y TypeScript.
- package.json, package-lock.json y .npmrc: comandos, dependencias y configuración en la raíz.
- scripts/check-db.mjs: PostgreSQL mediante pg, TLS con certificado validado y únicamente SELECT 1.
- tests/check-db.test.ts: contrato SQL con cliente falso, sin conexión real.
- .github/workflows/: ci.yml, security.yml, codeql.yml, deploy.yml y zap.yml.
- AGENTS.md, docs/PREFLIGHT.md y docs/PLAN.md: reglas, evidencia y plan.

Sin ORM ni contenedor de aplicación. Herramientas previstas: ESLint, Vitest, GitHub Actions, Gitleaks, CodeQL, Vercel, OWASP ZAP y Jira Scrum. Docker solo si aporta valor verificable.

## Evidencia y procedencia

REAL reportada por el usuario significa ejecución confirmada por el usuario, sin inspección de logs o artefactos por el agente en esta actualización. No implica ejecución nueva ni permisos en otros destinos. SIMULADA identifica un componente falso; PENDIENTE significa sin verificar.

| Estado | Verificación | Resultado y límite |
| --- | --- | --- |
| REAL, reportada por el usuario | npm ci | Finalizó correctamente. |
| REAL, reportada por el usuario | npm run check | Finalizó correctamente: lint, typecheck, Vitest y build. |
| REAL, reportada; BD SIMULADA | Pruebas Vitest del contrato SQL | Usan cliente falso; no acreditan conexión real a PostgreSQL. |
| REAL, reportada por el usuario | npm audit --audit-level=high | Finalizó correctamente; no implica ausencia total de vulnerabilidades. |
| REAL, reportada por el usuario | GitHub Actions CI y dependencias/secretos | Aprobados en el repositorio de ensayo; no acredita otros repositorios. |
| REAL, reportada por el usuario | Vercel | Despliegue correcto. No se ejecutó otro despliegue aquí. |
| REAL, reportada por el usuario | OWASP ZAP | Ejecutado: 11 categorías de advertencias. Detalle, impacto y correcciones pendientes de revisión; no equivale a un análisis sin hallazgos. |
| REAL, bloqueo reportado por el usuario | CodeQL | No pudo ejecutarse por falta de Code Scanning en el repositorio privado. No aprobado; sin resultados de análisis. |
| REAL, confirmación previa del usuario | Node → Neon | TLS y SELECT 1 exitosos; no repetir ni acceder a credenciales en esta actualización. |
| REAL, confirmaciones previas del usuario | GitHub CLI, Vercel CLI, npm y Docker Linux | Operativos fuera del sandbox. No repetir diagnósticos; no prueba permisos de futuros destinos. |
| PENDIENTE | Destinos definitivos y Jira del examen | Confirmar alcance, autorización y permisos efectivos para las operaciones requeridas. |
| PENDIENTE | Acceso GitHub MCP al repositorio actual o definitivo | La autenticación CLI y el ensayo de Actions no acreditan permisos del conector MCP. |

## Seguridad y límites

- No hay un bloqueo local identificado para comenzar el desarrollo cuando se autorice. Resolver la disponibilidad de CodeQL si la rúbrica lo exige, sin cambiar visibilidad, licencia ni configuración sin autorización.
- Revisar las 11 categorías de ZAP según evidencia y rúbrica. No inventar categorías, severidades ni declarar corregidos los hallazgos.
- No leer, imprimir, copiar ni versionar .env.local, tokens o cadenas de conexión. Solo procesos autorizados pueden cargar variables en ejecución; compartir únicamente evidencia saneada.
- PostgreSQL sigue limitado a SELECT 1 con TLS y certificado validado; tablas, migraciones y escrituras requieren autorización posterior.
- No crear recursos, hacer push, desplegar, modificar Jira ni escanear destinos externos sin autorización aplicable. El ensayo realizado no autoriza repetirlo.
- Deploy y ZAP son manuales y tienen authorized=false por defecto. CodeQL requiere ENABLE_CODEQL=true y disponibilidad/permisos de Code Scanning; la variable por sí sola no resuelve el bloqueo.

## Sandbox y comandos desde la raíz

El agente puede inspeccionar archivos locales y realizar cambios expresamente autorizados dentro del workspace. Esta tarea solo autoriza actualizar los tres documentos. No se ejecutaron instalaciones, pruebas, consultas SQL, red ni despliegues.

Los bloqueos históricos del sandbox incluyen red de procesos locales y acceso al motor Docker. Las operaciones afectadas requieren CMD externo del usuario y autorización aplicable. CMD dentro del sandbox no elimina esos bloqueos. En PowerShell, usar npm.cmd/npx.cmd/vercel.cmd si los wrappers .ps1 están bloqueados; no cambiar ExecutionPolicy ni solicitar elevación para eludir restricciones.

Comando de referencia para una futura revalidación autorizada, desde CMD externo situado en la raíz de DevOps-Examen:

```bat
npm ci && npm run check && npm audit --audit-level=high
```

Estas validaciones ya fueron confirmadas; no repetirlas ahora. La ruta vigente del verificador SQL es scripts/check-db.mjs. No hay scripts/verify-kit.cmd; no usarlo ni cargar .env.local en esta actualización.

## Siguiente paso

Revisar evidencia saneada de ZAP y decidir cómo cubrir CodeQL si la rúbrica lo exige. Conservar versiones y lockfile; esperar el enunciado y la autorización antes de implementar o realizar nuevas operaciones externas.
