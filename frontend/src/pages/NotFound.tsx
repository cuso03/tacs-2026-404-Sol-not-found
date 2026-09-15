import { ArrowLeft, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';

export default function NotFound() {
  return <Card className="mx-auto max-w-xl rounded-2xl border-dashed"><CardContent className="flex flex-col items-center px-6 py-16 text-center"><span className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><SearchX className="size-7" /></span><h1 className="mt-5 text-2xl font-black">Página no encontrada</h1><p className="mt-2 text-sm text-slate-500">La dirección no corresponde a una pantalla disponible.</p><Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft className="size-4" />Volver a descubrir</Link></CardContent></Card>;
}
