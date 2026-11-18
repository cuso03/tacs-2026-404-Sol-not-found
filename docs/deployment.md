# Publicación

La rama `dev` corresponde al ambiente GitHub `develop`; `main`, a `prod`.
Las demás ramas y los pull requests sólo ejecutan CI. Un disparo manual desde
otra rama se rechaza. No se usan datos mock ni URLs de API de ejemplo al publicar.

## Estado de esta preparación

El repositorio ya tenía Backend CI y Frontend CI. Ahora ambos pueden reutilizarse
desde `deploy-frontend.yml`. Los pushes a `dev` y `main` ejecutan ese workflow,
que valida ambos componentes antes de publicar el frontend en Cloudflare Pages.
Los PR hacia cualquiera de esas ramas y los pushes a las demás ramas mantienen
sus comprobaciones independientes. Las dependencias se instalan respetando los
lockfiles (`npm ci` y `pnpm install --frozen-lockfile`).

La publicación está desactivada hasta configurar la variable de repositorio
`TACS_PAGES_DEPLOY_ENABLED=true`. Sin ella se ejecutan los controles y se omite
el job de publicación. No se ha activado, subido esta rama ni desplegado nada.

**Este workflow sólo publica el frontend.** El CD del backend queda pendiente
de elegir y preparar su alojamiento. No reemplaza el Compose ni crea bases,
colas o servicios externos.

## Configuración de Pages

Crear un proyecto Pages por ambiente. La rama de producción del proyecto de
`develop` debe ser `dev`; la del proyecto de `prod`, `main`. Así ambos tienen su
URL estable aunque Cloudflare denomine "production" al despliegue principal de
cada proyecto. Esta etiqueta de Pages no cambia el ambiente GitHub.

En cada GitHub Environment configurar:

| Nombre | Tipo | Contenido |
|---|---|---|
| CLOUDFLARE_API_TOKEN | Secret | Token de publicación con Pages Edit |
| CLOUDFLARE_ACCOUNT_ID | Variable | Cuenta Cloudflare |
| CLOUDFLARE_PAGES_PROJECT | Variable | Proyecto Pages correspondiente |
| VITE_API_URL | Variable | URL HTTPS absoluta de la API, incluida su ruta `/api` |
| VITE_AUTH0_DOMAIN | Variable | Dominio Auth0 de la SPA |
| VITE_AUTH0_CLIENT_ID | Variable | Identificador público de la SPA |
| VITE_AUTH0_AUDIENCE | Variable | Audience de la API |

Los valores VITE son públicos. Los secretos de MongoDB, Redis, RabbitMQ, Telegram
y clima pertenecen al backend y nunca se incluyen en el bundle del navegador.
Pages no ejecuta el proxy `/api` configurado en Vite para desarrollo local.
Se debe registrar la URL de cada frontend en los callbacks/logout/orígenes de
Auth0 y en la configuración CORS del backend. El chequeo de configuración
valida formato, no conectividad ni autorización real de esos servicios.

Mantener protegido el workflow y restringir las ramas permitidas de cada
Environment. La publicación manual usa el código de la rama seleccionada y
vuelve a ejecutar ambos CI. Los despliegues de una misma rama se serializan;
no se cancela una publicación que ya esté en curso.

## Backend: decisión pendiente

El código actual utiliza Express, MongoDB, BullMQ/Redis, RabbitMQ y cron dentro
del proceso del servidor. Para modificar lo mínimo, la opción recomendada es
un servidor Docker con volúmenes persistentes, conservando esos servicios.

Cloudflare Containers puede ejecutar la imagen de Express, pero no importa
automáticamente la topología de Docker Compose. Su disco es efímero y hay que
resolver el ciclo de vida de los cron/consumidores, los reinicios y el escalado
para evitar tareas duplicadas. MongoDB y las colas durables necesitan servicios
persistentes externos u otro diseño. No se propone reemplazarlos por D1 o
Queues dentro de esta preparación.

La consulta autenticada de Containers y la de suscripciones devolvieron HTTP
403 con la sesión disponible. No demuestra que la cuenta carezca del producto;
faltan permisos para confirmar su habilitación y plan. Workers devolvió el
modelo `standard`, pero eso no sustituye la comprobación de Containers.

Referencias oficiales:

- https://developers.cloudflare.com/containers/faq/
- https://developers.cloudflare.com/containers/platform/pricing/
- https://developers.cloudflare.com/containers/get-started/
- https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/

Antes de activar la publicación deben pasar los builds y tests, estar disponible
el backend real y completarse una prueba del login y de una operación de la app.
Las verificaciones locales de YAML y scripts no prueban un despliegue remoto.
