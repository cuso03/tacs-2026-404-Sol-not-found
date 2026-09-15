import { useState } from 'react';
import Button from './ui/Button';

interface CreateActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateActivityModal({ isOpen, onClose }: CreateActivityModalProps) {
  // Estados para cada campo del formulario
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState('aire_libre');
  const [fechaHorario, setFechaHorario] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [minParticipantes, setMinParticipantes] = useState(4);
  const [maxParticipantes, setMaxParticipantes] = useState(10);

  // Si el modal no está abierto, no renderizamos nada
  if (!isOpen) return null;

  // Manejador del envío del formulario
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validación básica del prototipo
    if (maxParticipantes < minParticipantes) {
      alert("El cupo máximo debe ser mayor o igual al mínimo.");
      return;
    }

    const nuevaActividad = {
      titulo,
      descripcion,
      tipo,
      fecha_horario: fechaHorario,
      ubicacion,
      min_participantes: minParticipantes,
      max_participantes: maxParticipantes,
    };

    console.log("Datos a enviar a la API:", nuevaActividad);
    
    // Acá en el futuro llamaremos a Axios: axios.post('/api/activities', nuevaActividad)
    
    onClose(); // Cerramos el modal después de guardar
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100">
        
        {/* Header del Modal */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-lg">Nueva Actividad</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">
            ×
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Título de la actividad *</label>
            <input 
              type="text" 
              required 
              maxLength={150} 
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Fútbol 5 en Parque Centenario" 
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Descripción *</label>
            <textarea 
              required 
              maxLength={2000} 
              rows={2} 
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles de la actividad, qué llevar, etc..." 
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tipo</label>
              <select 
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="aire_libre">Aire libre</option>
                <option value="techada">Techada</option>
                <option value="mixta">Mixta</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fecha y Hora *</label>
              <input 
                type="datetime-local" 
                required 
                value={fechaHorario}
                onChange={(e) => setFechaHorario(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Ubicación (Ciudad o Coordenadas) *</label>
            <input 
              type="text" 
              required 
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Ej: Plaza Irlanda, Buenos Aires" 
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mín. Participantes</label>
              <input 
                type="number" 
                min="2" max="50" 
                value={minParticipantes}
                onChange={(e) => setMinParticipantes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Máx. Participantes</label>
              <input 
                type="number" 
                min="2" max="100" 
                value={maxParticipantes}
                onChange={(e) => setMaxParticipantes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Crear Actividad
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}