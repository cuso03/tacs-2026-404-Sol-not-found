import { useState, type FormEvent } from 'react';
import { useModificarActividad } from '../hooks/useActividades';
import { getApiErrorMessage } from '../services/api';
import type { Actividad, CrearActividadPayload } from '../types/api';
import LocationPicker from './LocationPicker';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { NativeSelect } from './ui/native-select';
import { Textarea } from './ui/textarea';

export default function EditActivityModal({ activity, onClose }: { activity: Actividad; onClose: () => void }) {
  const mutation = useModificarActividad();
  const [payload, setPayload] = useState<CrearActividadPayload>({ titulo: activity.titulo, descripcion: activity.descripcion, tipo: activity.tipo, ubicacion: activity.ubicacion, fecha_horario: activity.fecha_horario, min_participantes: activity.min_participantes, max_participantes: activity.max_participantes });
  const localDate = new Date(new Date(activity.fecha_horario).getTime() - new Date(activity.fecha_horario).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [date, setDate] = useState(localDate);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (payload.max_participantes < Math.max(payload.min_participantes, activity.participantes.length)) throw new Error('El cupo debe cubrir el mínimo y los participantes inscriptos.');
      await mutation.mutateAsync({ id: activity.id, payload: { ...payload, fecha_horario: new Date(date).toISOString() } });
      onClose();
    } catch (cause) { setError(getApiErrorMessage(cause)); }
  }
  return <Dialog open onOpenChange={open => !open && !mutation.isPending && onClose()}><DialogContent className="max-h-[94vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Modificar actividad</DialogTitle><DialogDescription>Actualizá los datos de la actividad. Si hay una votación abierta, se cerrará sin resolver al guardar.</DialogDescription></DialogHeader>
    {error && <Alert><AlertDescription>{error}</AlertDescription></Alert>}
    <form onSubmit={submit} className="space-y-4">
      <div><Label htmlFor="edit-title">Título</Label><Input id="edit-title" required maxLength={150} value={payload.titulo} onChange={e => setPayload({ ...payload, titulo: e.target.value })} /></div>
      <div><Label htmlFor="edit-description">Descripción</Label><Textarea id="edit-description" required maxLength={2000} value={payload.descripcion} onChange={e => setPayload({ ...payload, descripcion: e.target.value })} /></div>
      <div><Label htmlFor="edit-type">Tipo</Label><NativeSelect id="edit-type" value={payload.tipo} onChange={e => setPayload({ ...payload, tipo: e.target.value as CrearActividadPayload['tipo'] })}><option value="aire_libre">Aire libre</option><option value="techada">Techada</option><option value="mixta">Mixta</option></NativeSelect></div>
      <div><Label htmlFor="edit-date">Fecha y hora</Label><Input id="edit-date" type="datetime-local" required value={date} onChange={e => setDate(e.target.value)} /></div>
      {payload.ubicacion.tipo === 'ciudad' && <p className="text-sm">Ubicación actual: {payload.ubicacion.ciudad}, {payload.ubicacion.pais}</p>}
      <LocationPicker value={payload.ubicacion.tipo === 'coordenadas' ? { ...payload.ubicacion, direccion: payload.ubicacion.direccion ?? '' } : undefined} onChange={location => setPayload({ ...payload, ubicacion: { tipo: 'coordenadas', ...location } })} />
      <div className="grid grid-cols-2 gap-4"><div><Label htmlFor="edit-min">Mínimo de participantes</Label><Input id="edit-min" type="number" required min={1} value={payload.min_participantes} onChange={e => setPayload({ ...payload, min_participantes: Number(e.target.value) })} /></div><div><Label htmlFor="edit-max">Máximo de participantes</Label><Input id="edit-max" type="number" required min={activity.participantes.length} value={payload.max_participantes} onChange={e => setPayload({ ...payload, max_participantes: Number(e.target.value) })} /></div></div>
      <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar cambios'}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
