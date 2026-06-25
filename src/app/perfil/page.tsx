'use client';

import { useState } from 'react';
import { useProfile } from '@/lib/profile/ProfileContext';
import { TIMEZONE } from '@/lib/profile/defaults';
import { hullSpeedKt } from '@/lib/domain/polarModel';
import { KNOWN_CLUBS, type KnownClub } from '@/lib/config/knownClubs';
import { track } from '@/lib/analytics';
import { type Caution, type LocationKind, DEFAULT_LOW_WIND_KT } from '@/lib/profile/types';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/States';

const CAUTION_OPTS: { value: Caution; label: string; desc: string }[] = [
  { value: 'prudente', label: 'Prudente', desc: 'Umbrales más exigentes' },
  { value: 'normal', label: 'Normal', desc: 'Equilibrado' },
  { value: 'audaz', label: 'Audaz', desc: 'Tolera más viento' },
];

const KIND_OPTS: { value: LocationKind; label: string }[] = [
  { value: 'amarra', label: 'Amarra / salida' },
  { value: 'destino', label: 'Destino' },
  { value: 'punto', label: 'Otro punto' },
];

export default function PerfilPage() {
  const {
    profile,
    hydrated,
    addBoat,
    removeBoat,
    setActiveBoat,
    addLocation,
    updateLocation,
    removeLocation,
    setActiveLocation,
    setCaution,
    setLowWind,
  } = useProfile();

  if (!hydrated) return <Loading />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mi perfil</h1>
        <p className="text-slate-500 text-sm">
          Tus barcos y lugares se guardan solo en este navegador (sin registro). La info
          del panel y del cruce se adapta a tu barco y lugar activos.
        </p>
      </div>

      {/* BARCOS */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-700">Mis barcos</h2>
        {profile.boats.length === 0 && (
          <p className="text-sm text-slate-400">Todavía no agregaste ningún barco.</p>
        )}
        <div className="space-y-2">
          {profile.boats.map((b) => (
            <Card key={b.id} className="p-3 flex items-center justify-between gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="activeBoat"
                  checked={profile.activeBoatId === b.id}
                  onChange={() => setActiveBoat(b.id)}
                  className="accent-mar-600"
                />
                <span>
                  <span className="font-medium text-slate-800">{b.name}</span>
                  <span className="text-slate-400 text-sm">
                    {' '}· {b.lengthFt} pies · vel. máx ≈ {hullSpeedKt(b.lengthFt).toFixed(1)} kt
                  </span>
                </span>
              </label>
              <button
                onClick={() => removeBoat(b.id)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Eliminar
              </button>
            </Card>
          ))}
        </div>
        <AddBoatForm
          onAdd={(name, lengthFt) => {
            addBoat({ name, lengthFt });
            track('add_boat', { lengthFt });
          }}
        />
      </section>

      {/* LUGARES */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-700">Mis lugares</h2>
        <p className="text-xs text-slate-400">
          Marcá tu amarra como lugar activo del panel. Tip: en Google Maps, hacé clic
          derecho sobre un punto para copiar sus coordenadas (latitud, longitud).
        </p>
        <div className="space-y-2">
          {profile.locations.map((l) => (
            <Card key={l.id} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="activeLocation"
                    checked={profile.activeLocationId === l.id}
                    onChange={() => setActiveLocation(l.id)}
                    className="accent-mar-600"
                  />
                  <span>
                    <span className="font-medium text-slate-800">{l.name}</span>
                    <span className="text-slate-400 text-sm">
                      {' '}· {l.kind} · {l.lat.toFixed(4)}, {l.lon.toFixed(4)}
                    </span>
                  </span>
                </label>
                <button
                  onClick={() => removeLocation(l.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Eliminar
                </button>
              </div>
              <LocationLevels
                location={l}
                onSave={(min, max) =>
                  updateLocation(l.id, { safeLevelMinM: min, safeLevelMaxM: max })
                }
              />
            </Card>
          ))}
        </div>
        <AddKnownClubForm
          onAdd={(club, kind) => {
            addLocation({ name: club.name, lat: club.lat, lon: club.lon, kind, timezone: TIMEZONE });
            track('add_known_club', { name: club.name, country: club.country });
          }}
        />
        <AddLocationForm
          onAdd={(name, lat, lon, kind) => {
            addLocation({ name, lat, lon, kind, timezone: TIMEZONE });
            track('add_location', { kind });
          }}
        />
      </section>

      {/* CAUTELA */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-700">Nivel de tolerancia</h2>
        <div className="flex gap-2 flex-wrap">
          {CAUTION_OPTS.map((o) => (
            <button
              key={o.value}
              onClick={() => setCaution(o.value)}
              className={`rounded-lg border px-3 py-2 text-sm text-left ${
                profile.caution === o.value
                  ? 'border-mar-500 bg-mar-50 text-mar-800'
                  : 'border-slate-200 text-slate-600 hover:border-mar-300'
              }`}
            >
              <div className="font-medium">{o.label}</div>
              <div className="text-xs opacity-70">{o.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* POCO VIENTO */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-700">Umbral de poco viento</h2>
        <p className="text-xs text-slate-400">
          Por debajo de este viento se marca <strong>“poco viento”</strong> (probablemente no
          se pueda navegar a vela). También es la línea azul del gráfico.
        </p>
        <LowWindForm value={profile.lowWindKt} onSave={setLowWind} />
      </section>
    </div>
  );
}

function LowWindForm({ value, onSave }: { value?: number; onSave: (kt: number) => void }) {
  const [kt, setKt] = useState((value ?? DEFAULT_LOW_WIND_KT).toString());

  const commit = () => {
    const n = Number(kt);
    if (Number.isFinite(n) && n >= 1 && n <= 25) onSave(Math.round(n));
    else setKt((value ?? DEFAULT_LOW_WIND_KT).toString());
  };

  return (
    <div className="flex gap-2 items-end">
      <Field label="Poco viento (kt)">
        <input
          type="number"
          min={1}
          max={25}
          value={kt}
          onChange={(e) => setKt(e.target.value)}
          onBlur={commit}
          className="input w-28"
        />
      </Field>
    </div>
  );
}

function AddBoatForm({ onAdd }: { onAdd: (name: string, lengthFt: number) => void }) {
  const [name, setName] = useState('');
  const [length, setLength] = useState('23');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ft = Number(length);
    if (!name.trim() || !Number.isFinite(ft) || ft < 8 || ft > 80) return;
    onAdd(name.trim(), ft);
    setName('');
    setLength('23');
  };

  return (
    <form onSubmit={submit} className="flex gap-2 flex-wrap items-end">
      <Field label="Nombre del barco">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Plenamar New 23"
          className="input"
        />
      </Field>
      <Field label="Eslora (pies)">
        <input
          type="number"
          value={length}
          onChange={(e) => setLength(e.target.value)}
          min={8}
          max={80}
          className="input w-28"
        />
      </Field>
      <button type="submit" className="btn-primary">
        Agregar barco
      </button>
    </form>
  );
}

function AddLocationForm({
  onAdd,
}: {
  onAdd: (name: string, lat: number, lon: number, kind: LocationKind) => void;
}) {
  const [name, setName] = useState('');
  const [coords, setCoords] = useState('');
  const [kind, setKind] = useState<LocationKind>('amarra');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'error' | 'unsupported'>('idle');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const m = coords.split(',').map((s) => Number(s.trim()));
    if (!name.trim() || m.length !== 2 || !Number.isFinite(m[0]) || !Number.isFinite(m[1])) return;
    onAdd(name.trim(), m[0], m[1], kind);
    setName('');
    setCoords('');
  };

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unsupported');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        setCoords(`${lat}, ${lon}`);
        setGeoStatus('idle');
      },
      () => setGeoStatus('error'),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  };

  return (
    <form onSubmit={submit} className="flex gap-2 flex-wrap items-end">
      <Field label="Nombre del lugar">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Mi amarra"
          className="input"
        />
      </Field>
      <Field label="Coordenadas (lat, lon)">
        <div className="flex items-center gap-2">
          <input
            value={coords}
            onChange={(e) => setCoords(e.target.value)}
            placeholder="-34.8399, -57.9234"
            className="input w-56"
          />
          <button
            type="button"
            onClick={useMyLocation}
            disabled={geoStatus === 'loading'}
            className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 hover:border-mar-500 disabled:opacity-50"
          >
            📍 {geoStatus === 'loading' ? 'Ubicando…' : 'Mi ubicación'}
          </button>
        </div>
        {geoStatus === 'error' && (
          <span className="mt-1 block text-xs text-amber-600">No se pudo obtener tu ubicación.</span>
        )}
        {geoStatus === 'unsupported' && (
          <span className="mt-1 block text-xs text-amber-600">
            Tu navegador no permite geolocalización.
          </span>
        )}
      </Field>
      <Field label="Tipo">
        <select value={kind} onChange={(e) => setKind(e.target.value as LocationKind)} className="input">
          {KIND_OPTS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className="btn-primary">
        Agregar lugar
      </button>
    </form>
  );
}

function AddKnownClubForm({
  onAdd,
}: {
  onAdd: (club: KnownClub, kind: LocationKind) => void;
}) {
  const [idx, setIdx] = useState('');
  const [kind, setKind] = useState<LocationKind>('amarra');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const i = Number(idx);
    if (idx === '' || !Number.isInteger(i) || !KNOWN_CLUBS[i]) return;
    onAdd(KNOWN_CLUBS[i], kind);
    setIdx('');
  };

  return (
    <form onSubmit={submit} className="flex gap-2 flex-wrap items-end">
      <Field label="Agregar club conocido (Río de la Plata)">
        <select value={idx} onChange={(e) => setIdx(e.target.value)} className="input w-72">
          <option value="" disabled>
            Elegí un club…
          </option>
          <optgroup label="Argentina 🇦🇷">
            {KNOWN_CLUBS.map((c, i) =>
              c.country === 'AR' ? (
                <option key={i} value={i}>
                  {c.name}
                </option>
              ) : null,
            )}
          </optgroup>
          <optgroup label="Uruguay 🇺🇾">
            {KNOWN_CLUBS.map((c, i) =>
              c.country === 'UY' ? (
                <option key={i} value={i}>
                  {c.name}
                </option>
              ) : null,
            )}
          </optgroup>
        </select>
      </Field>
      <Field label="Tipo">
        <select value={kind} onChange={(e) => setKind(e.target.value as LocationKind)} className="input">
          {KIND_OPTS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className="btn-primary" disabled={idx === ''}>
        Agregar club
      </button>
    </form>
  );
}

function LocationLevels({
  location,
  onSave,
}: {
  location: { safeLevelMinM?: number; safeLevelMaxM?: number };
  onSave: (min: number | undefined, max: number | undefined) => void;
}) {
  const [min, setMin] = useState(location.safeLevelMinM?.toString() ?? '');
  const [max, setMax] = useState(location.safeLevelMaxM?.toString() ?? '');
  const defined = location.safeLevelMinM != null || location.safeLevelMaxM != null;

  const commit = () => {
    const parse = (s: string) => {
      const n = Number(s);
      return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
    };
    onSave(parse(min), parse(max));
  };

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-mar-700 marker:content-none">
        ▾ Niveles seguros de la amarra (opcional){defined ? ' · definidos' : ''}
      </summary>
      <div className="mt-2 flex gap-3 items-end flex-wrap">
        <Field label="Mínimo (m)">
          <input
            type="number"
            step="0.1"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            onBlur={commit}
            placeholder="ej: 0.6"
            className="input w-28"
          />
        </Field>
        <Field label="Máximo (m)">
          <input
            type="number"
            step="0.1"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            onBlur={commit}
            placeholder="ej: 2.4"
            className="input w-28"
          />
        </Field>
        <p className="text-xs text-slate-400 max-w-sm">
          Referidos al mismo nivel que muestra el INA. Si los definís, el panel avisa cuando
          el agua queda por debajo del mínimo (riesgo de varar) o por encima del máximo.
        </p>
      </div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-500">{label}</span>
      {children}
    </label>
  );
}
