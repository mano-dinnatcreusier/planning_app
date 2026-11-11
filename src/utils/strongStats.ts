// Calculs Strong purs (sans React) : tri des exercices par usage, détection des PR.
import type { StrongWorkout, StrongWorkoutSet } from '../types';

export const normName = (name: string) => (name || '').toLowerCase().trim();
const weightKey = (w: number) => String(Math.round((Number(w) || 0) * 100) / 100);

/** Date locale du jour au format YYYY-MM-DD (et non la date UTC). */
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dayMs = 86_400_000;
const parseDay = (d: string) => {
  const [y, m, day] = (d || '').split(/[ T]/)[0].split('-').map(Number);
  return y && m && day ? Date.UTC(y, m - 1, day) : NaN;
};

/**
 * Score d'usage par exercice (clé : nom normalisé) : chaque séance où l'exercice apparaît
 * compte 0.5^(âge / demi-vie). Une séance d'aujourd'hui vaut 1, une séance vieille
 * d'une demi-vie vaut 0,5, etc. Un exercice abandonné depuis des mois tend vers 0.
 */
export const exerciseUsageScores = (
  workouts: StrongWorkout[],
  halfLifeDays = 21,
  today: string = localToday()
): Map<string, number> => {
  const now = parseDay(today);
  const scores = new Map<string, number>();
  for (const w of workouts) {
    const t = parseDay(w.date);
    if (Number.isNaN(t)) continue;
    const age = Math.max(0, (now - t) / dayMs);
    const weight = Math.pow(0.5, age / halfLifeDays);
    const seen = new Set<string>();
    for (const s of w.sets || []) {
      const n = normName(s.exercise_name);
      if (!n || seen.has(n)) continue; // une séance compte une fois par exercice
      seen.add(n);
      scores.set(n, (scores.get(n) || 0) + weight);
    }
  }
  return scores;
};

/** Trie des noms d'exercices par score d'usage décroissant, puis par ordre alphabétique. */
export const sortByUsage = <T,>(items: T[], getName: (x: T) => string, scores: Map<string, number>): T[] =>
  [...items].sort((a, b) => {
    const d = (scores.get(normName(getName(b))) || 0) - (scores.get(normName(getName(a))) || 0);
    return d !== 0 ? d : getName(a).localeCompare(getName(b));
  });

export interface NewPR {
  exercise: string;
  weight: number;
  reps: number;
  previousReps: number; // 0 = poids jamais soulevé sur cet exercice
}

/**
 * PR d'une nouvelle séance : pour un exercice et un poids donnés, plus de reps que
 * le maximum jamais fait à ce poids dans l'historique. Un poids jamais soulevé compte
 * pour 0 rep, donc la première série à ce poids (≥ 1 rep) est un PR.
 * Un seul PR par (exercice, poids) : la meilleure série de la séance.
 */
export const detectNewPRs = (history: StrongWorkout[], sets: StrongWorkoutSet[]): NewPR[] => {
  const best = new Map<string, number>(); // `${exercice}|${poids}` → reps max
  for (const w of history) {
    for (const s of w.sets || []) {
      const k = `${normName(s.exercise_name)}|${weightKey(s.weight)}`;
      const r = Number(s.reps) || 0;
      if (r > (best.get(k) || 0)) best.set(k, r);
    }
  }
  const session = new Map<string, NewPR>();
  for (const s of sets) {
    const reps = Number(s.reps) || 0;
    if (reps <= 0 || !normName(s.exercise_name)) continue;
    const k = `${normName(s.exercise_name)}|${weightKey(s.weight)}`;
    const cur = session.get(k);
    if (!cur || reps > cur.reps) {
      session.set(k, { exercise: s.exercise_name.trim(), weight: Number(s.weight) || 0, reps, previousReps: best.get(k) || 0 });
    }
  }
  return [...session.values()].filter(p => p.reps > p.previousReps);
};
