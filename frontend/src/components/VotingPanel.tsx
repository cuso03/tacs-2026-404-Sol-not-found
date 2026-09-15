import { useState } from 'react';
import { CalendarPlus, CheckCircle2, Clock3, LoaderCircle, Lock, Plus, RefreshCw, Sparkles, Trash2, Vote } from 'lucide-react';
import { useAbrirVotacion, useCerrarVotacion, useFechasDisponibles, useResultadosVotacion, useVotar } from '../hooks/useVotaciones';
import { formatDateTime, toDateTimeLocal } from '../lib/formatters';
import { CURRENT_USER_ID, getApiErrorMessage } from '../services/api';
import type { AbrirVotacionPayload } from '../services/votaciones';
import type { Actividad, Votacion } from '../types/api';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';

interface VotingPanelProps {
  activity: Actividad;
}

/** Gestiona apertura, voto, resultados parciales y cierre de las votaciones. */
export default function VotingPanel({ activity }: VotingPanelProps) {
  const latestVoting = activity.votaciones.at(-1);
  const activeVoting = activity.votaciones.find((voting) => voting.estado === 'ABIERTA');
  const resultsQuery = useResultadosVotacion(activity.id, latestVoting?.id);
  const [mode, setMode] = useState<'automatica' | 'manual'>('automatica');
  const [duration, setDuration] = useState(24);
  const [manualDates, setManualDates] = useState(['']);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const suggestionsMutation = useFechasDisponibles();
  const abrirMutation = useAbrirVotacion();
  const votarMutation = useVotar();
  const cerrarMutation = useCerrarVotacion();

  const organizer = activity.creadorId === CURRENT_USER_ID;
  const participant = activity.participantes.includes(CURRENT_USER_ID);
  const results = resultsQuery.data;
  const displayedVoting = results?.votacion ?? latestVoting;
  const resultsError = resultsQuery.isError ? getApiErrorMessage(resultsQuery.error) : '';
  const currentError = error || resultsError;

  async function openVoting() {
    setError('');
    setFeedback('');
    try {
      const payload: AbrirVotacionPayload = { duracion_horas: duration };
      if (mode === 'manual') {
        const selectedDates = manualDates.filter(Boolean);
        if (selectedDates.length === 0) throw new Error('Agregá al menos una alternativa de fecha y horario.');
        payload.alternativas = selectedDates.map((date) => ({ fecha_horario: new Date(date).toISOString() }));
      }
      await abrirMutation.mutateAsync({ activityId: activity.id, payload });
      setFeedback('La votación quedó abierta para todas las personas inscriptas.');
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    }
  }

  async function castVote(voting: Votacion, alternativeId: string) {
    setError('');
    setFeedback('');
    try {
      await votarMutation.mutateAsync({ activityId: activity.id, votingId: voting.id, alternativaId: alternativeId });
      setFeedback('Tu voto fue registrado. Podés cambiarlo mientras la votación siga abierta.');
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    }
  }

  async function closeVoting(voting: Votacion) {
    setError('');
    setFeedback('');
    try {
      const result = await cerrarMutation.mutateAsync({ activityId: activity.id, votingId: voting.id });
      setFeedback(result.estado === 'REPROGRAMADA' ? 'La votación se resolvió y la actividad fue reprogramada.' : 'La votación se cerró y la actividad fue cancelada por falta de una alternativa ganadora con quórum.');
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    }
  }

  function loadSuggestedDates() {
    setError('');
    setFeedback('');
    suggestionsMutation.mutate(activity.id, {
      onSuccess: (data) => {
        if (data.fechas.length === 0) {
          setError('No se encontraron horarios favorables dentro del rango configurado.');
          return;
        }
        setManualDates(data.fechas.slice(0, 5).map(toDateTimeLocal));
        setMode('manual');
        setFeedback('Cargamos las alternativas con pronóstico favorable. Podés editarlas antes de abrir la votación.');
      },
      onError: (cause) => setError(getApiErrorMessage(cause)),
    });
  }

  function refreshResults() {
    if (displayedVoting) void resultsQuery.refetch();
  }

  const pendingVoteId = votarMutation.isPending ? votarMutation.variables?.alternativaId : undefined;
  const actionPending = abrirMutation.isPending || votarMutation.isPending || cerrarMutation.isPending;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="p-6 pb-4"><div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2 text-lg"><Vote className="size-5 text-blue-600" />Reprogramación</CardTitle><p className="mt-1 text-xs text-slate-500">Alternativas, votos y resolución de cambios de fecha.</p></div>{displayedVoting && <Badge variant={displayedVoting.estado === 'ABIERTA' ? 'warning' : 'secondary'}>{displayedVoting.estado === 'ABIERTA' ? 'Votación abierta' : 'Votación cerrada'}</Badge>}</div></CardHeader>
      <CardContent className="space-y-5 px-6 pb-6">
        {currentError && <Alert><AlertTitle>No pudimos completar la acción</AlertTitle><AlertDescription>{currentError}</AlertDescription></Alert>}
        {feedback && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800"><AlertDescription>{feedback}</AlertDescription></Alert>}

        {organizer && !activeVoting && (
          activity.reglasClima ? (
            <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div><h3 className="text-sm font-bold">Abrir una nueva votación</h3><p className="mt-1 text-xs text-slate-500">El sistema puede generar opciones por clima o podés definirlas manualmente.</p></div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMode('automatica')} className={`rounded-xl border p-3 text-left transition ${mode === 'automatica' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}><Sparkles className="mb-2 size-4 text-blue-600" /><span className="block text-sm font-semibold">Automática</span><span className="mt-1 block text-xs text-slate-500">Opciones con buen clima</span></button>
                <button type="button" onClick={() => setMode('manual')} className={`rounded-xl border p-3 text-left transition ${mode === 'manual' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}><CalendarPlus className="mb-2 size-4 text-blue-600" /><span className="block text-sm font-semibold">Manual</span><span className="mt-1 block text-xs text-slate-500">Fechas elegidas por vos</span></button>
              </div>
              {mode === 'manual' && <div className="space-y-3"><div className="flex items-center justify-between"><Label>Alternativas</Label><Button variant="ghost" size="sm" disabled={suggestionsMutation.isPending} onClick={loadSuggestedDates}>{suggestionsMutation.isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}Sugerir por clima</Button></div>{manualDates.map((date, index) => <div key={index} className="flex gap-2"><Input type="datetime-local" aria-label={`Alternativa ${index + 1}`} value={date} onChange={(event) => setManualDates((dates) => dates.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><Button variant="ghost" size="icon" aria-label={`Eliminar alternativa ${index + 1}`} disabled={manualDates.length === 1} onClick={() => setManualDates((dates) => dates.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></Button></div>)}{manualDates.length < 5 && <Button variant="outline" size="sm" onClick={() => setManualDates((dates) => [...dates, ''])}><Plus className="size-3.5" />Agregar alternativa</Button>}</div>}
              <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-end"><div className="space-y-2"><Label htmlFor="voting-duration">Duración (horas)</Label><Input id="voting-duration" type="number" min={1} max={168} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></div><Button disabled={abrirMutation.isPending} onClick={() => void openVoting()}>{abrirMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Vote className="size-4" />}Abrir votación</Button></div>
            </div>
          ) : <Alert><AlertDescription>Configurá primero las reglas climáticas para poder abrir una votación.</AlertDescription></Alert>
        )}

        {displayedVoting ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{displayedVoting.estado === 'ABIERTA' ? `Cierra ${formatDateTime(displayedVoting.cierraEn)}` : `Cerrada ${formatDateTime(displayedVoting.cerradaEn ?? displayedVoting.cierraEn)}`}</span><span>·</span><span>{displayedVoting.automatica ? 'Alternativas automáticas' : 'Alternativas manuales'}</span><span>·</span><span>{results?.totalVotos ?? Object.keys(displayedVoting.votos).length} votos</span></div>
            <div className="space-y-3">{displayedVoting.alternativas.map((alternative) => {
              const votes = results?.conteo[alternative.id] ?? Object.values(displayedVoting.votos).filter((id) => id === alternative.id).length;
              const percentage = activity.participantes.length ? votes / activity.participantes.length * 100 : 0;
              const selected = displayedVoting.votos[CURRENT_USER_ID] === alternative.id;
              return <div key={alternative.id} className={`rounded-xl border p-4 ${selected ? 'border-blue-400 bg-blue-50/70' : 'border-slate-200'}`}><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="font-semibold">{formatDateTime(alternative.fecha_horario)}</p><p className="mt-1 text-xs text-slate-500">{votes} {votes === 1 ? 'voto' : 'votos'}{selected ? ' · Tu elección' : ''}</p></div>{displayedVoting.estado === 'ABIERTA' && participant && <Button size="sm" variant={selected ? 'secondary' : 'outline'} disabled={actionPending} onClick={() => void castVote(displayedVoting, alternative.id)}>{pendingVoteId === alternative.id ? <LoaderCircle className="size-3.5 animate-spin" /> : selected ? <CheckCircle2 className="size-3.5" /> : <Vote className="size-3.5" />}{selected ? 'Votada' : 'Votar'}</Button>}</div><Progress value={percentage} className="mt-3" /></div>;
            })}</div>
            {displayedVoting.estado === 'ABIERTA' && !participant && <Alert><AlertDescription>Tenés que estar inscripto en la actividad para votar.</AlertDescription></Alert>}
            <div className="flex flex-wrap justify-between gap-3"><Button variant="ghost" size="sm" onClick={() => void refreshResults()}><RefreshCw className={`size-3.5 ${resultsQuery.isFetching ? 'animate-spin' : ''}`} />Actualizar resultados</Button>{organizer && displayedVoting.estado === 'ABIERTA' && <Button variant="destructive" size="sm" disabled={actionPending} onClick={() => void closeVoting(displayedVoting)}>{cerrarMutation.isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}Cerrar y resolver</Button>}</div>
          </div>
        ) : !organizer && <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center"><Vote className="mx-auto mb-3 size-7 text-slate-300" /><p className="text-sm font-semibold">Todavía no hay votaciones</p><p className="mt-1 text-xs text-slate-500">El organizador podrá abrir una si necesita reprogramar.</p></div>}
      </CardContent>
    </Card>
  );
}