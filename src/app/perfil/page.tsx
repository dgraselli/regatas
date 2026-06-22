'use client';

import { useState } from 'react';
import { useProfile } from '@/lib/profile/ProfileContext';
import { TIMEZONE } from '@/lib/profile/defaults';
import { hullSpeedKt } from '@/lib/domain/polarModel';
import { KNOWN_CLUBS, type KnownClub } from '@/lib/config/knownClubs';
import type { Caution, LocationKind } from '@/lib/profile/types';
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
    removeLocation,
    setActiveLocation,
    setCaution,
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
        <AddBoatForm onAdd={(name, lengthFt) => addBoat({ name, lengthFt })} />
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
            <Card key={l.id} className="p-3 flex items-center justify-between gap-3">
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
            </Card>
          ))}
        </div>
        <AddKnownClubForm
          onAdd={(club, kind) =>
            addLocation({ name: club.name, lat: club.lat, lon: club.lon, kind, timezone: TIMEZONE })
          }
        />
        <AddLocationForm
          onAdd={(name, lat, lon, kind) =>
            addLocation({ name, lat, lon, kind, timezone: TIMEZONE })
          }
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const m = coords.split(',').map((s) => Number(s.trim()));
    if (!name.trim() || m.length !== 2 || !Number.isFinite(m[0]) || !Number.isFinite(m[1])) return;
    onAdd(name.trim(), m[0], m[1], kind);
    setName('');
    setCoords('');
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
        <input
          value={coords}
          onChange={(e) => setCoords(e.target.value)}
          placeholder="-34.8399, -57.9234"
          className="input w-56"
        />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-500">{label}</span>
      {children}
    </label>
  );
}
