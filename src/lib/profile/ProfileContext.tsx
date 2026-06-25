'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Boat,
  Profile,
  SavedLocation,
  Caution,
  CrossingSelection,
} from '@/lib/profile/types';
import { DEFAULT_PROFILE, PROFILE_VERSION } from '@/lib/profile/defaults';

const STORAGE_KEY = 'regatas-profile';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
}

function load(): Profile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Profile;
    if (parsed.version !== PROFILE_VERSION) return { ...DEFAULT_PROFILE, ...parsed, version: PROFILE_VERSION };
    return parsed;
  } catch {
    return DEFAULT_PROFILE;
  }
}

interface ProfileContextValue {
  profile: Profile;
  /** false hasta que se hidrata desde localStorage (evita parpadeo SSR). */
  hydrated: boolean;
  activeBoat: Boat | null;
  activeLocation: SavedLocation | null;
  addBoat: (b: Omit<Boat, 'id'>) => Boat;
  updateBoat: (id: string, patch: Partial<Omit<Boat, 'id'>>) => void;
  removeBoat: (id: string) => void;
  setActiveBoat: (id: string | null) => void;
  addLocation: (l: Omit<SavedLocation, 'id'>) => SavedLocation;
  updateLocation: (id: string, patch: Partial<Omit<SavedLocation, 'id'>>) => void;
  removeLocation: (id: string) => void;
  setActiveLocation: (id: string | null) => void;
  setCaution: (c: Caution) => void;
  setLowWind: (kt: number) => void;
  setCrossingSelection: (patch: CrossingSelection) => void;
}

const Ctx = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  // Hidratar desde localStorage en el cliente.
  useEffect(() => {
    setProfile(load());
    setHydrated(true);
  }, []);

  // Persistir cada cambio (una vez hidratado).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      /* almacenamiento lleno o bloqueado: se ignora */
    }
  }, [profile, hydrated]);

  const addBoat = useCallback((b: Omit<Boat, 'id'>) => {
    const boat: Boat = { ...b, id: newId() };
    setProfile((p) => ({
      ...p,
      boats: [...p.boats, boat],
      activeBoatId: p.activeBoatId ?? boat.id,
    }));
    return boat;
  }, []);

  const updateBoat = useCallback((id: string, patch: Partial<Omit<Boat, 'id'>>) => {
    setProfile((p) => ({
      ...p,
      boats: p.boats.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }, []);

  const removeBoat = useCallback((id: string) => {
    setProfile((p) => {
      const boats = p.boats.filter((b) => b.id !== id);
      return {
        ...p,
        boats,
        activeBoatId: p.activeBoatId === id ? (boats[0]?.id ?? null) : p.activeBoatId,
      };
    });
  }, []);

  const setActiveBoat = useCallback((id: string | null) => {
    setProfile((p) => ({ ...p, activeBoatId: id }));
  }, []);

  const addLocation = useCallback((l: Omit<SavedLocation, 'id'>) => {
    const loc: SavedLocation = { ...l, id: newId() };
    setProfile((p) => ({
      ...p,
      locations: [...p.locations, loc],
      activeLocationId:
        p.activeLocationId ?? (loc.kind === 'amarra' ? loc.id : p.activeLocationId),
    }));
    return loc;
  }, []);

  const updateLocation = useCallback(
    (id: string, patch: Partial<Omit<SavedLocation, 'id'>>) => {
      setProfile((p) => ({
        ...p,
        locations: p.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }));
    },
    [],
  );

  const removeLocation = useCallback((id: string) => {
    setProfile((p) => {
      const locations = p.locations.filter((l) => l.id !== id);
      return {
        ...p,
        locations,
        activeLocationId:
          p.activeLocationId === id ? (locations[0]?.id ?? null) : p.activeLocationId,
      };
    });
  }, []);

  const setActiveLocation = useCallback((id: string | null) => {
    setProfile((p) => ({ ...p, activeLocationId: id }));
  }, []);

  const setCaution = useCallback((c: Caution) => {
    setProfile((p) => ({ ...p, caution: c }));
  }, []);

  const setLowWind = useCallback((kt: number) => {
    setProfile((p) => ({ ...p, lowWindKt: kt }));
  }, []);

  const setCrossingSelection = useCallback((patch: CrossingSelection) => {
    setProfile((p) => ({ ...p, crossing: { ...p.crossing, ...patch } }));
  }, []);

  const activeBoat = useMemo(
    () => profile.boats.find((b) => b.id === profile.activeBoatId) ?? null,
    [profile.boats, profile.activeBoatId],
  );
  const activeLocation = useMemo(
    () => profile.locations.find((l) => l.id === profile.activeLocationId) ?? null,
    [profile.locations, profile.activeLocationId],
  );

  const value: ProfileContextValue = {
    profile,
    hydrated,
    activeBoat,
    activeLocation,
    addBoat,
    updateBoat,
    removeBoat,
    setActiveBoat,
    addLocation,
    updateLocation,
    removeLocation,
    setActiveLocation,
    setCaution,
    setLowWind,
    setCrossingSelection,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfile debe usarse dentro de <ProfileProvider>');
  return ctx;
}
