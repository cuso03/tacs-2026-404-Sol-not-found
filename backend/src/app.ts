import express from 'express';
import actividadesRoutes from './routes/actividadesRoutes';

const app = express();
const PORT = 3000;

// Middleware para que Express entienda el formato JSON en los Request Body
app.use(express.json());

// Vinculamos la ruta base /api/actividades con el archivo de rutas que creamos
app.use('/api/actividades', actividadesRoutes);

// Iniciamos el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});