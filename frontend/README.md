# Frontend — 404 Sol Not Found

Aplicación React + TypeScript + Vite. Los componentes visuales reutilizables se
encuentran en `src/components/ui` y siguen la composición de shadcn/ui.

## Gestión de actividades

El botón **Nueva actividad** abre un flujo de dos pasos:

1. Datos generales, tipo, fecha, cupos y ubicación exacta mediante buscador y mapa interactivo.
2. Límites climáticos, anticipación y ventana de reprogramación.

El cliente ejecuta `POST /api/actividades` y luego
`PUT /api/actividades/{id}/reglas`. En desarrollo utiliza `VITE_USER_ID` como
identidad simulada y, si no se define, usa `auth0|user-1`.

El proxy de Vite dirige `/api` al backend. Docker Compose configura el destino
interno mediante `VITE_PROXY_TARGET=http://backend:3000`.

## Mapa y búsqueda de ubicaciones

El selector usa React Leaflet, los mosaicos estándar de OpenStreetMap y búsquedas
explícitas en Nominatim. No realiza autocompletado: cachea búsquedas repetidas y
limita las consultas a una por segundo. Para cambiar de proveedor sin modificar
el código se pueden configurar `VITE_MAP_TILE_URL` y `VITE_GEOCODING_URL`.

Los servicios públicos de OpenStreetMap son adecuados para desarrollo y tráfico
moderado, sin garantía de disponibilidad. Antes de un despliegue de producción
con muchos usuarios se debe contratar o alojar un proveedor con capacidad y SLA
acordes. Ver las políticas de [Nominatim](https://operations.osmfoundation.org/policies/nominatim/)
y de [mosaicos](https://operations.osmfoundation.org/policies/tiles/).

```bash
pnpm install --no-frozen-lockfile
pnpm run build
pnpm test
pnpm run dev
```

El CI utiliza pnpm para evitar el error interno `edgesOut` del resolvedor de npm.
Cuando pnpm pueda ejecutarse en un entorno de desarrollo, debe versionarse el
archivo `pnpm-lock.yaml` generado y cambiar la instalación a `pnpm install
--frozen-lockfile`.

---

## Plantilla original

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
