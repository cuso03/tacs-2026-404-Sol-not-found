import axios from 'axios';

const api = axios.create({
  // En Vite, import.meta.env accede a las variables de entorno (.env)
  // Usamos localhost:3000 como fallback si no está definida
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
    // Simulamos un usuario logueado según tu requerimiento
    'X-User-Id': 'auth0|user-1', 
  },
});

export default api;