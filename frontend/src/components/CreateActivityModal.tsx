import { useState, type FormEvent, type ReactNode } from 'react';
import { configurarReglas, crearActividad } from '../services/actividadesApi';
import type { Actividad, CrearActividadPayload, ReglasClimaPayload, TipoActividad } from '../types/actividad';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { NativeSelect } from './ui/native-select';
import { Textarea } from './ui/textarea';

interface CreateActivityModalProps { isOpen: boolean; onClose: () => void; onCreated?: (actividad: Actividad) => void; }
type LocationMode = 'coordenadas' | 'ciudad';

const currentUserId = import.meta.env.VITE_USER_ID ?? 'auth0|frontend-demo';

/** Formulario en dos pasos para crear una actividad y asociarle reglas climáticas. */
export default function CreateActivityModal({ isOpen, onClose, onCreated }: CreateActivityModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string>();
  const [createdActivity, setCreatedActivity] = useState<Actividad>();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<TipoActividad>('aire_libre');
  const [fechaHorario, setFechaHorario] = useState('');
  const [locationMode, setLocationMode] = useState<LocationMode>('coordenadas');
  const [ciudad, setCiudad] = useState('');
  const [pais, setPais] = useState('AR');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [direccion, setDireccion] = useState('');
  const [minParticipantes, setMinParticipantes] = useState(2);
  const [maxParticipantes, setMaxParticipantes] = useState(10);

  const [lluviaMax, setLluviaMax] = useState(40);
  const [temperaturaMin, setTemperaturaMin] = useState(10);
  const [temperaturaMax, setTemperaturaMax] = useState(30);
  const [vientoMax, setVientoMax] = useState(35);
  const [horasAnticipacion, setHorasAnticipacion] = useState(24);
  const [diasReprogramacion, setDiasReprogramacion] = useState(3);
  const [horarioMin, setHorarioMin] = useState('10:00');
  const [horarioMax, setHorarioMax] = useState('20:00');

  /** Restablece el flujo para que una reapertura nunca conserve una actividad anterior. */
  function closeAndReset() {
    setStep(1); setError(''); setIsSubmitting(false); setCreatedId(undefined); setCreatedActivity(undefined);
    setTitulo(''); setDescripcion(''); setTipo('aire_libre'); setFechaHorario(''); setLocationMode('coordenadas');
    setCiudad(''); setPais('AR'); setLatitud(''); setLongitud(''); setDireccion(''); setMinParticipantes(2); setMaxParticipantes(10);
    setLluviaMax(40); setTemperaturaMin(10); setTemperaturaMax(30); setVientoMax(35); setHorasAnticipacion(24);
    setDiasReprogramacion(3); setHorarioMin('10:00'); setHorarioMax('20:00');
    onClose();
  }

  /** Construye y valida el payload de la Feature 1 antes de avanzar. */
  function buildActivityPayload(): CrearActividadPayload {
    if (!titulo.trim() || !descripcion.trim() || !fechaHorario) throw new Error('Completá todos los campos obligatorios.');
    if (maxParticipantes < minParticipantes) throw new Error('El cupo máximo debe ser mayor o igual al mínimo.');

    const ubicacion = locationMode === 'ciudad'
      ? { tipo: 'ciudad' as const, ciudad: ciudad.trim(), pais: pais.trim() }
      : { tipo: 'coordenadas' as const, latitud: Number(latitud), longitud: Number(longitud), ...(direccion.trim() && { direccion: direccion.trim() }) };
    if (locationMode === 'ciudad' && (!ciudad.trim() || !pais.trim())) throw new Error('Indicá ciudad y país.');
    if (locationMode === 'coordenadas' && (latitud === '' || longitud === '' || !Number.isFinite(Number(latitud)) || !Number.isFinite(Number(longitud)))) throw new Error('Indicá coordenadas válidas.');
    if (locationMode === 'coordenadas' && (Number(latitud) < -90 || Number(latitud) > 90 || Number(longitud) < -180 || Number(longitud) > 180)) throw new Error('Las coordenadas están fuera del rango permitido.');

    return { titulo: titulo.trim(), descripcion: descripcion.trim(), tipo, ubicacion, fecha_horario: new Date(fechaHorario).toISOString(), min_participantes: minParticipantes, max_participantes: maxParticipantes };
  }

  /** Construye y valida el payload climático de la Feature 2. */
  function buildRulesPayload(): ReglasClimaPayload {
    if (lluviaMax < 0 || lluviaMax > 100) throw new Error('La probabilidad de lluvia debe estar entre 0 y 100%.');
    if (temperaturaMax < temperaturaMin) throw new Error('La temperatura máxima debe ser mayor o igual a la mínima.');
    if (vientoMax < 0 || horasAnticipacion < 1 || diasReprogramacion < 1) throw new Error('Viento, anticipación y reprogramación deben tener valores válidos.');
    if (horarioMin >= horarioMax) throw new Error('El horario máximo debe ser posterior al mínimo.');
    return { probabilidad_lluvia_max: lluviaMax, temperatura_min: temperaturaMin, temperatura_max: temperaturaMax, viento_max: vientoMax, horas_anticipacion: horasAnticipacion, dias_max_reprogramacion: diasReprogramacion, rango_horario: { horario_min: horarioMin, horario_max: horarioMax } };
  }

  function handleActivityStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { buildActivityPayload(); setError(''); setStep(2); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisá los datos ingresados.'); }
  }

  /** Persiste primero la actividad y luego sus reglas, reutilizando el id si el segundo POST debe reintentarse. */
  async function handleRulesStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setIsSubmitting(true);
    try {
      const rules = buildRulesPayload();
      const activityId = createdId ?? (await crearActividad(buildActivityPayload(), currentUserId)).id;
      setCreatedId(activityId);
      const configuredActivity = await configurarReglas(activityId, rules, currentUserId);
      setCreatedActivity(configuredActivity);
      onCreated?.(configuredActivity);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la actividad.');
    } finally { setIsSubmitting(false); }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAndReset()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        {createdActivity ? (
          <div className="space-y-6 py-5 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-2xl">✓</div>
            <DialogHeader className="text-center">
              <DialogTitle>Actividad lista</DialogTitle>
              <DialogDescription>“{createdActivity.titulo}” fue creada con sus reglas de clima y reprogramación.</DialogDescription>
            </DialogHeader>
            <Button onClick={closeAndReset}>Volver a actividades</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600"><span>Paso {step} de 2</span><span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full bg-blue-600 transition-all ${step === 1 ? 'w-1/2' : 'w-full'}`} /></span></div>
              <DialogTitle>{step === 1 ? 'Nueva actividad' : 'Reglas de clima y reprogramación'}</DialogTitle>
              <DialogDescription>{step === 1 ? 'Definí cuándo, dónde y para cuántas personas.' : 'Elegí qué clima aceptás y cómo puede reprogramarse.'}</DialogDescription>
            </DialogHeader>

            {error && <Alert><AlertTitle>Revisá el formulario</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

            {step === 1 ? (
              <form onSubmit={handleActivityStep} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Título" htmlFor="titulo" className="sm:col-span-2"><Input id="titulo" required maxLength={150} value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Fútbol 5 en Parque Centenario" /></Field>
                  <Field label="Descripción" htmlFor="descripcion" className="sm:col-span-2"><Textarea id="descripcion" required maxLength={2000} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Qué van a hacer, qué llevar y otros detalles" /></Field>
                  <Field label="Tipo" htmlFor="tipo"><NativeSelect id="tipo" value={tipo} onChange={(event) => setTipo(event.target.value as TipoActividad)}><option value="aire_libre">Aire libre</option><option value="techada">Techada</option><option value="mixta">Mixta</option></NativeSelect></Field>
                  <Field label="Fecha y hora" htmlFor="fecha"><Input id="fecha" type="datetime-local" required value={fechaHorario} onChange={(event) => setFechaHorario(event.target.value)} /></Field>
                  <Field label="Tipo de ubicación" htmlFor="ubicacion-tipo" className="sm:col-span-2"><NativeSelect id="ubicacion-tipo" value={locationMode} onChange={(event) => setLocationMode(event.target.value as LocationMode)}><option value="coordenadas">Coordenadas exactas (recomendado)</option><option value="ciudad">Ciudad y país</option></NativeSelect></Field>
                  {locationMode === 'ciudad' ? <><Field label="Ciudad" htmlFor="ciudad"><Input id="ciudad" required value={ciudad} onChange={(event) => setCiudad(event.target.value)} placeholder="Buenos Aires" /></Field><Field label="País" htmlFor="pais"><Input id="pais" required value={pais} onChange={(event) => setPais(event.target.value)} placeholder="AR" /></Field></> : <><Field label="Latitud" htmlFor="latitud"><Input id="latitud" type="number" required min={-90} max={90} step="any" value={latitud} onChange={(event) => setLatitud(event.target.value)} placeholder="-34.6037" /></Field><Field label="Longitud" htmlFor="longitud"><Input id="longitud" type="number" required min={-180} max={180} step="any" value={longitud} onChange={(event) => setLongitud(event.target.value)} placeholder="-58.3816" /></Field><Field label="Dirección de referencia (opcional)" htmlFor="direccion" className="sm:col-span-2"><Input id="direccion" value={direccion} onChange={(event) => setDireccion(event.target.value)} placeholder="Plaza de Mayo" /></Field></>}
                  <Field label="Mínimo de participantes" htmlFor="min"><Input id="min" type="number" required min={1} value={minParticipantes} onChange={(event) => setMinParticipantes(Number(event.target.value))} /></Field>
                  <Field label="Máximo de participantes" htmlFor="max"><Input id="max" type="number" required min={1} value={maxParticipantes} onChange={(event) => setMaxParticipantes(Number(event.target.value))} /></Field>
                </div>
                <DialogFooter><Button variant="outline" onClick={closeAndReset}>Cancelar</Button><Button type="submit">Continuar a reglas →</Button></DialogFooter>
              </form>
            ) : (
              <form onSubmit={handleRulesStep} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Lluvia máxima (%)" htmlFor="lluvia"><Input id="lluvia" type="number" required min={0} max={100} value={lluviaMax} onChange={(event) => setLluviaMax(Number(event.target.value))} /></Field>
                  <Field label="Temperatura mínima (°C)" htmlFor="temp-min"><Input id="temp-min" type="number" required min={-100} max={100} value={temperaturaMin} onChange={(event) => setTemperaturaMin(Number(event.target.value))} /></Field>
                  <Field label="Temperatura máxima (°C)" htmlFor="temp-max"><Input id="temp-max" type="number" required min={-100} max={100} value={temperaturaMax} onChange={(event) => setTemperaturaMax(Number(event.target.value))} /></Field>
                  <Field label="Viento máximo (km/h)" htmlFor="viento"><Input id="viento" type="number" required min={0} max={500} value={vientoMax} onChange={(event) => setVientoMax(Number(event.target.value))} /></Field>
                  <Field label="Avisar con anticipación (h)" htmlFor="anticipacion"><Input id="anticipacion" type="number" required min={1} max={720} value={horasAnticipacion} onChange={(event) => setHorasAnticipacion(Number(event.target.value))} /></Field>
                  <Field label="Reprogramar hasta (días)" htmlFor="dias"><Input id="dias" type="number" required min={1} max={365} value={diasReprogramacion} onChange={(event) => setDiasReprogramacion(Number(event.target.value))} /></Field>
                  <Field label="Horario desde" htmlFor="hora-min"><Input id="hora-min" type="time" required value={horarioMin} onChange={(event) => setHorarioMin(event.target.value)} /></Field>
                  <Field label="Horario hasta" htmlFor="hora-max"><Input id="hora-max" type="time" required value={horarioMax} onChange={(event) => setHorarioMax(event.target.value)} /></Field>
                </div>
                <p className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">Estas reglas se aplicarán al pronóstico de la ubicación definida en el paso anterior.</p>
                <DialogFooter><Button variant="outline" disabled={isSubmitting} onClick={() => { setError(''); setStep(1); }}>← Volver</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Crear actividad'}</Button></DialogFooter>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: ReactNode }) {
  return <div className={className}><Label htmlFor={htmlFor}>{label}</Label><div className="mt-1.5">{children}</div></div>;
}
