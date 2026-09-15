import { useEffect, useMemo, useRef, useState } from 'react';
import { divIcon, type Marker as LeafletMarker } from 'leaflet';
import { LoaderCircle, MapPin, Search } from 'lucide-react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAddress } from '../services/geocoding';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/Button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export interface SelectedLocation {
  latitud: number;
  longitud: number;
  direccion: string;
}

interface LocationPickerProps {
  value?: SelectedLocation;
  onChange: (location: SelectedLocation) => void;
}

const initialCenter: [number, number] = [-34.6037, -58.3816];
const tileUrl = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const markerIcon = divIcon({
  className: 'activity-location-marker',
  html: '<span aria-hidden="true"></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
});

function MapViewport({ value }: { value?: SelectedLocation }) {
  const map = useMap();

  useEffect(() => {
    if (value) map.setView([value.latitud, value.longitud], 16);
  }, [map, value]);

  return null;
}

function MapClickHandler({ onMove }: { onMove: (latitud: number, longitud: number) => void }) {
  useMapEvents({ click: (event) => onMove(event.latlng.lat, event.latlng.lng) });
  return null;
}

function DraggableMarker({ value, onMove }: { value: SelectedLocation; onMove: (latitud: number, longitud: number) => void }) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const point = marker.getLatLng();
        onMove(point.lat, point.lng);
      }
    },
  }), [onMove]);

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      icon={markerIcon}
      position={[value.latitud, value.longitud]}
      ref={markerRef}
    />
  );
}

/** Selector de ubicación por búsqueda, clic en el mapa o arrastre del marcador. */
export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [wasAdjusted, setWasAdjusted] = useState(false);

  async function handleSearch() {
    setError('');
    setIsSearching(true);
    try {
      const result = await geocodeAddress(query);
      if (!result) {
        setError('No encontramos esa ubicación. Probá agregando ciudad y provincia.');
        return;
      }
      setWasAdjusted(false);
      onChange(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos buscar esa ubicación.');
    } finally {
      setIsSearching(false);
    }
  }

  function handleMove(latitud: number, longitud: number) {
    setWasAdjusted(true);
    onChange({
      latitud: Number(latitud.toFixed(6)),
      longitud: Number(longitud.toFixed(6)),
      direccion: value?.direccion ?? (query.trim() || 'Ubicación seleccionada en el mapa'),
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="ubicacion-busqueda">Ubicación exacta</Label>
        <div className="flex gap-2">
          <Input
            id="ubicacion-busqueda"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSearch();
              }
            }}
            placeholder="Ej: Plaza Irlanda, Buenos Aires"
            autoComplete="street-address"
          />
          <Button type="button" variant="outline" disabled={isSearching} aria-label="Buscar ubicación" onClick={() => void handleSearch()}>
            {isSearching ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
            <span className="hidden sm:inline">Buscar</span>
          </Button>
        </div>
        <p className="text-xs text-slate-500">Buscá el lugar y ajustá el marcador arrastrándolo o haciendo clic en el mapa.</p>
      </div>

      {error && <Alert><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="location-map overflow-hidden rounded-xl border border-slate-200" aria-label="Mapa para seleccionar la ubicación">
        <MapContainer center={initialCenter} zoom={12} scrollWheelZoom className="h-64 w-full">
          <TileLayer
            referrerPolicy="strict-origin-when-cross-origin"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={tileUrl}
          />
          <MapViewport value={value} />
          <MapClickHandler onMove={handleMove} />
          {value && <DraggableMarker value={value} onMove={handleMove} />}
        </MapContainer>
      </div>

      {value ? (
        <div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900" role="status">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{value.direccion}</p>
            <p className="mt-0.5 text-blue-700">{value.latitud.toFixed(6)}, {value.longitud.toFixed(6)}{wasAdjusted ? ' · marcador ajustado' : ''}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs font-medium text-amber-700">Todavía no seleccionaste un punto en el mapa.</p>
      )}

      <p className="text-[11px] text-slate-400">
        La búsqueda se envía a <a className="underline hover:text-slate-600" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>; no ingreses información privada adicional.
      </p>
    </div>
  );
}
