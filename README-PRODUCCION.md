# Puesta en producción — Campañas · Workspace

La app ahora tiene dos modos:

- **Modo local** (sin configurar nada): funciona igual que el prototipo, guardando en el navegador.
- **Modo producción** (con Supabase): login real con correo y contraseña, datos compartidos en una base PostgreSQL, sincronización en vivo entre todos los usuarios y auditoría de cambios.

## Paso 1 — Crear el proyecto en Supabase (5 min)

1. Entra a https://supabase.com y crea una cuenta (plan gratuito).
2. Crea un proyecto nuevo (elige una región cercana, p. ej. *South America (São Paulo)*).
3. Guarda la contraseña de la base de datos que te pide (no la necesitarás a diario, pero consérvala).

## Paso 2 — Crear las tablas

1. En el panel de Supabase, abre **SQL Editor**.
2. Copia todo el contenido de `supabase/schema.sql`, pégalo y pulsa **Run**.
3. Debe terminar sin errores. Esto crea la tabla `app_state` (estado compartido), la tabla `app_state_audit` (quién cambió qué y cuándo), activa la seguridad por filas y el tiempo real.

## Paso 3 — Crear los usuarios del equipo (login único)

1. Ve a **Authentication → Users → Add user → Create new user**.
2. Crea un usuario por cada persona del equipo (correo + contraseña). Marca "Auto confirm user".
3. Recomendado: en **Authentication → Sign In / Up**, desactiva los registros públicos (*Allow new users to sign up* → off) para que solo entren las cuentas que tú creas.
4. Dentro de la app, ve a **Configuración → Equipo** y, en la nueva columna **Correo (login)**, asigna a cada miembro el mismo correo de su cuenta de Supabase.

Con eso el login queda **unificado**: la persona inicia sesión una sola vez (correo + contraseña) y entra directo ya identificada como su miembro, con su rol y permisos. No hay segunda pantalla. "Cerrar sesión" dentro de la app cierra ambas capas a la vez.

> Si alguien inicia sesión y su correo aún no está asignado a ningún miembro, verá el selector clásico solo esa vez; apenas el administrador asigne el correo, las próximas entradas serán directas.

## Paso 4 — Conectar la app

1. En Supabase, ve a **Settings → API** y copia:
   - **Project URL** (algo como `https://abcd1234.supabase.co`)
   - **anon public key**
2. Abre `app/config.js` y pega ambos valores. La clave *anon* es segura en el navegador porque la tabla exige sesión iniciada (RLS).

## Paso 5 — Publicar el sitio

La app es estática: cualquier hosting sirve. El camino más simple:

1. Entra a https://app.netlify.com (gratis) → **Add new site → Deploy manually**.
2. Arrastra la carpeta completa del proyecto (la que contiene `index.html` y `app/`).
3. En segundos tendrás una URL tipo `https://tu-sitio.netlify.app`. Puedes conectar un dominio propio después.

Alternativas equivalentes: Cloudflare Pages o Vercel.

> Importante: la app debe abrirse desde un servidor (la URL del hosting o `python3 -m http.server` para pruebas locales). Abrir `index.html` con doble clic no funciona porque el navegador bloquea la carga de los módulos.

## Paso 6 — Primer arranque y migración de datos

- La primera persona que entre con la base **vacía** "siembra" la base con lo que tenga en su navegador. Si ya venías trabajando en el prototipo, abre la app publicada **desde ese mismo navegador** la primera vez: tus datos actuales se migran solos a Supabase.
- A partir de ahí, todo lo que cualquiera edite se guarda en la nube y aparece en vivo en las pantallas del resto (verás un indicador "Sincronizado" abajo a la derecha).

## Qué se sincroniza y qué no

Se comparte entre todos: campañas, briefs y sus versiones, checklists, comunicaciones, tareas y pendientes, solicitudes de diseño, miembros, roles, fechas del periodo, planner del día.

Queda por dispositivo (no se comparte): la sesión interna de miembro, el rol activo, el filtro de periodo seleccionado, la barra lateral plegada, el modo lectura del brief y el temporizador personal.

## Trazabilidad

Cada cambio queda registrado en la tabla `app_state_audit` (acción, valor anterior, valor nuevo, usuario y fecha). Puedes consultarla en Supabase → Table Editor, o con SQL, por ejemplo: `select * from app_state_audit order by created_at desc limit 50;`

## Limitaciones honestas de esta Fase 1 (y cuál es la Fase 2)

- El modelo guarda el estado como clave→valor (espejo del prototipo). Si dos personas editan **el mismo bloque** (p. ej. el mismo brief) en el mismo segundo, gana la última escritura. Para el tamaño de equipo típico de este flujo es aceptable, pero no es edición colaborativa carácter a carácter.
- Las contraseñas internas ("claves") del selector de miembros siguen siendo informativas, no criptográficas. La seguridad real la pone el login de Supabase.
- La **Fase 2** es normalizar entidad por entidad hacia el modelo de `docs/Arquitectura Backend.md` (tablas `tasks`, `briefs`, `comms`, etc., RBAC en el servidor con políticas RLS por rol, y reportes). La capa `RemoteSync` se diseñó para que esa migración pueda hacerse módulo a módulo sin detener la app.

## Perfiles de usuario

- **Primera entrada:** al iniciar sesión por primera vez, la app pide nombres, apodo, edad y foto (opcional), y da la bienvenida con una frase filosófica motivacional. Se puede posponer con "Completar más tarde" (volverá a aparecer en la próxima visita).
- **Editar mi perfil:** clic en tu nombre/avatar (abajo del sidebar en escritorio, o pestaña "Más" en móvil) → *Editar mi perfil*.
- **Admin:** en Configuración → Equipo, el botón de persona en cada fila abre el perfil de ese miembro para editarlo.
- **Fotos:** se recortan y comprimen automáticamente (144 px, ~15 KB), así que no pesan en la base. El avatar aparece en el menú de usuario, en el login, en *Mis pendientes* y en las columnas por responsable del Centro de operaciones.

## Control de acceso en producción (importante)

- Nadie navega como invitado: con backend configurado, toda persona debe quedar firmada como un miembro. Si su correo aún no está vinculado, verá el selector de miembros una sola vez y su correo se vinculará automáticamente al miembro que elija.
- El rol por defecto es **Visualizador** (mínimo privilegio); los permisos de administrador solo se obtienen firmando como un miembro con ese rol.
- **Recomendado:** asigna una *clave* (Configuración → Equipo → pestaña de claves) a los miembros con rol Administrador o Editor. Así, en esa primera vinculación, nadie puede elegir un miembro privilegiado sin conocer su clave.

## Arranque limpio (sin datos de demostración)

En producción la app ya **no siembra datos de ejemplo**: parte con todas las configuraciones y parámetros vacíos (los datos demo solo existen en modo local/prototipo). Además, la nube es la fuente de verdad: si una clave no existe en la base, se purga del navegador automáticamente.

Si tu base ya quedó contaminada con datos de prueba, ejecútalo una vez:
1. Supabase → SQL Editor → pega y corre `supabase/reset.sql` (vacía el estado y deja un centinela; no toca cuentas ni tablas).
2. Redespliega la carpeta actualizada al hosting.
3. Recarga la app: entrarás a un espacio en cero. Crea los miembros reales en Configuración → Equipo y cada persona quedará vinculada por su correo en su primera entrada.


## Login único (solo Supabase)

El login nativo de la app (selector de miembro + clave) quedó retirado en producción: la única puerta es la cuenta de Supabase (correo + contraseña).

- Si el correo de la cuenta coincide con un miembro → entra directo con su rol.
- Si la base está recién estrenada (sin miembros) → el primer usuario que entre se convierte automáticamente en el administrador inicial.
- Si hay miembros pero el correo no coincide con ninguno → pantalla de "Cuenta pendiente de vincular"; se desbloquea sola en cuanto un admin escribe ese correo en Equipo → Correo (login).
- Las confirmaciones de acciones destructivas (eliminar campañas, miembros, etc.) ahora piden la **contraseña de la cuenta** y se verifican contra Supabase. Las claves internas ya no cumplen ninguna función en producción y pueden dejarse vacías.

## Plan piloto (1 mes en Supabase gratuito)

El stack actual (Netlify + Supabase free) soporta el piloto completo sin costo. Cuando termine el piloto y migren a un hosting robusto, **nada del código cambia**: solo se crea el nuevo proyecto/servidor, se corre `schema.sql`, se restaura el último respaldo y se actualizan las dos claves de `config.js`.

Rutina recomendada durante el piloto: exportar un **respaldo semanal** (Equipo → Datos y respaldo) y guardarlo fuera del navegador (Drive/correo).

## Versión optimizada (carpeta dist/)

El proyecto ahora incluye un build de producción precompilado: la carpeta **`dist/`** trae todo el código ya compilado y minificado en un solo archivo, con React en modo producción y sin compilador en el navegador → la app carga 3–5× más rápido, especialmente en celulares.

- **Para desplegar: arrastra `dist/` a Netlify** (en vez de la carpeta fuente). Recuerda poner tus claves en `dist/app/config.js` (es el mismo formato de siempre).
- La carpeta fuente sigue funcionando igual (modo desarrollo); cada zip que recibas ya incluye `dist/` regenerada y al día.
- Si alguna vez editas el código tú mismo: `npm install` (una vez) y `npm run build` regeneran `dist/`.

## Pruebas automatizadas

`npm test` (o `node tests/run-tests.mjs`) ejecuta la suite que verifica las reglas críticas: RBAC con mínimo privilegio, duplicado sin estados de completado, fechas referenciadas a fechas clave, historial transversal y el particionado anticolisión. Correrla antes de cada despliegue toma 1 segundo.

## Robustez de sincronización

- **Anticolisión:** los pendientes generales y las solicitudes de diseño ahora se guardan en una clave por ítem (`gp:<id>`, `dr:<id>`); dos personas editando ítems distintos a la vez ya no se pisan. La migración del formato anterior es automática.
- **Fallo de red:** si un cambio no logra guardarse tras varios reintentos, aparece un banner rojo persistente con botón Reintentar, y el navegador advierte si intentas cerrar la pestaña con cambios sin guardar.

## Checklist de lanzamiento del piloto

1. ☐ `dist/app/config.js` tiene la URL y la clave publishable correctas.
2. ☐ `supabase/schema.sql` ejecutado · registros públicos desactivados (Authentication → Sign In/Up).
3. ☐ `supabase/reset.sql` ejecutado (arranque limpio) — DESPUÉS de desplegar la versión actual.
4. ☐ Carpeta `dist/` desplegada · verifica el sello "build" en el menú de usuario (coincide con la fecha del build).
5. ☐ Entras tú primero → quedas como admin inicial → completa tu perfil.
6. ☐ Crea los miembros del equipo y sus cuentas en Supabase (mismo correo).
7. ☐ Configura las plantillas de checklist (Equipo → Plantillas) ANTES de habilitar campañas.
8. ☐ Exporta el primer respaldo (queda el contador en verde).
9. ☐ Comparte al equipo: la URL, su correo/contraseña, y dos tips: Ctrl+K para buscar y "Reportar un error" en su menú.

**Limitación conocida:** la pantalla de login no tiene "olvidé mi contraseña". Si alguien la pierde durante el piloto, el admin la restablece en 30 segundos: Supabase → Authentication → Users → (usuario) → "Send password recovery" o "Update password".
