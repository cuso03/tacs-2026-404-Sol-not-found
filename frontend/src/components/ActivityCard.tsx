interface ActivityProps {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: 'aire_libre' | 'techada' | 'mixta';
  estado: string;
  fecha: string;
  ubicacion: string;
  cuposOcupados: number;
  cuposMaximos: number;
}

export default function ActivityCard({
  titulo,
  descripcion,
  tipo,
  estado,
  fecha,
  ubicacion,
  cuposOcupados,
  cuposMaximos
}: ActivityProps) {
  
  const isFull = cuposOcupados >= cuposMaximos;

  // Funciones helper para los badges
  const formatTipo = (t: string) => {
    const tipos = { aire_libre: '🌳 Aire libre', techada: '🏢 Techada', mixta: '⛅ Mixta' };
    return tipos[t as keyof typeof tipos] || t;
  };

  const formatEstado = (e: string) => {
    const estilos: Record<string, string> = {
      'PROPUESTA': 'bg-blue-50 text-blue-700 border-blue-200',
      'EN_VOTACION': 'bg-amber-50 text-amber-800 border-amber-300 font-bold animate-pulse',
      'CONFIRMADA': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'REPROGRAMADA': 'bg-cyan-50 text-cyan-700 border-cyan-200',
      'CANCELADA': 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return estilos[e] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 p-5 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
            {formatTipo(tipo)}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs border font-medium ${formatEstado(estado)}`}>
            {estado.replace('_', ' ')}
          </span>
        </div>

        <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition line-clamp-1">
          {titulo}
        </h3>
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{descripcion}</p>

        <div className="mt-4 space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>📅</span>
            <span className="font-medium">{fecha}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span className="truncate">{ubicacion}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className={`font-medium ${isFull ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
          👥 {cuposOcupados}/{cuposMaximos} cupos
        </span>
        <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition inline-flex items-center">
          Ver detalle →
        </span>
      </div>
    </div>
  );
}