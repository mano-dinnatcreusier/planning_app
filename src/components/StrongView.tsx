import React, { useState, useMemo } from 'react';
import { useGoals } from '../context/GoalContext';
import { 
  Dumbbell, 
  Plus, 
  Trash2, 
  Calendar, 
  Database, 
  Search, 
  Copy, 
  Upload, 
  ChevronRight, 
  Sparkles,
  Trophy,
  BarChart3,
  TrendingUp,
  Flame,
  Activity
} from 'lucide-react';
import type { StrongWorkoutSet } from '../types';

export const StrongView: React.FC = () => {
  const { 
    strongExercises, 
    strongWorkouts, 
    addStrongExercise, 
    deleteStrongExercise, 
    addStrongWorkout, 
    deleteStrongWorkout, 
    importStrongCSVData,
    isSupabaseConnected
  } = useGoals();

  // Top Section: 'workouts' (Séances & Exercices) | 'stats' (Statistiques & Progression)
  const [mainSection, setMainSection] = useState<'workouts' | 'stats'>('workouts');

  // Workouts sub-tab: 'history' | 'add' | 'exercises'
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'add' | 'exercises'>('history');

  // Stats tab states
  const [statsMetric, setStatsMetric] = useState<'tonnage' | 'sets'>('tonnage');
  const [selectedStatsEx, setSelectedStatsEx] = useState<string>('');
  const [hoveredWeek, setHoveredWeek] = useState<{ label: string; tonnage: number; sets: number; workouts: number } | null>(null);
  const [hoveredExPoint, setHoveredExPoint] = useState<{ date: string; maxWeight: number; best1RM: number } | null>(null);

  // History states
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({});
  const [pageSize, setPageSize] = useState(20);

  // New Workout Form state
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutName, setWorkoutName] = useState('Entraînement de musculation');
  const [selectedExercises, setSelectedExercises] = useState<{ exerciseName: string; sets: { weight: string; reps: string }[] }[]>([]);
  const [formErrorMsg, setFormErrorMsg] = useState('');
  const [formSuccessMsg, setFormSuccessMsg] = useState('');

  // Exercise database states
  const [newExName, setNewExName] = useState('');
  const [exErrorMsg, setExErrorMsg] = useState('');
  const [exSuccessMsg, setExSuccessMsg] = useState('');
  
  // CSV Import States
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState('');
  const [importError, setImportError] = useState('');
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // Toggle expand/collapse workout card
  const toggleWorkout = (id: string) => {
    setExpandedWorkouts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper: Get Personal Records (PR) for all exercises
  // PR is defined as the max weight lifted for each exercise name across all workouts
  const personalRecords = useMemo(() => {
    const prs: Record<string, { weight: number; reps: number; date: string }> = {};
    strongWorkouts.forEach(w => {
      (w.sets || []).forEach(s => {
        const name = s.exercise_name;
        if (!prs[name] || s.weight > prs[name].weight) {
          prs[name] = { weight: s.weight, reps: s.reps, date: w.date };
        }
      });
    });
    return prs;
  }, [strongWorkouts]);

  // Global aggregate stats
  const globalStrongStats = useMemo(() => {
    let totalSets = 0;
    let totalTonnage = 0;
    strongWorkouts.forEach(w => {
      (w.sets || []).forEach(s => {
        totalSets++;
        totalTonnage += (Number(s.weight) || 0) * (Number(s.reps) || 0);
      });
    });
    return {
      totalWorkouts: strongWorkouts.length,
      totalSets,
      totalTonnage: Math.round(totalTonnage),
      tonnageTonnes: (totalTonnage / 1000).toFixed(1)
    };
  }, [strongWorkouts]);

  // Weekly volume data for the last 8 weeks
  const weeklyVolumeData = useMemo(() => {
    const weeksMap = new Map<string, { label: string; date: Date; sets: number; tonnage: number; workouts: number }>();
    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diffToMonday);
    thisMonday.setHours(0, 0, 0, 0);

    const weekKeys: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const wDate = new Date(thisMonday);
      wDate.setDate(thisMonday.getDate() - (i * 7));
      const key = wDate.toISOString().split('T')[0];
      weekKeys.push(key);
      const label = `${wDate.getDate()} ${wDate.toLocaleDateString('fr-FR', { month: 'short' })}`;
      weeksMap.set(key, { label, date: wDate, sets: 0, tonnage: 0, workouts: 0 });
    }

    strongWorkouts.forEach(w => {
      if (!w.date) return;
      const wDate = new Date(w.date);
      const wDay = wDate.getDay();
      const diffM = (wDay === 0 ? -6 : 1) - wDay;
      const monday = new Date(wDate);
      monday.setDate(wDate.getDate() + diffM);
      monday.setHours(0, 0, 0, 0);
      const key = monday.toISOString().split('T')[0];

      if (weeksMap.has(key)) {
        const item = weeksMap.get(key)!;
        item.workouts++;
        (w.sets || []).forEach(s => {
          item.sets++;
          item.tonnage += (Number(s.weight) || 0) * (Number(s.reps) || 0);
        });
      }
    });

    return weekKeys.map(k => weeksMap.get(k)!);
  }, [strongWorkouts]);

  // Exercise options list
  const exerciseOptions = useMemo(() => {
    const names = new Set<string>();
    strongWorkouts.forEach(w => {
      (w.sets || []).forEach(s => {
        if (s.exercise_name) names.add(s.exercise_name.trim());
      });
    });
    strongExercises.forEach(e => {
      if (e.name) names.add(e.name.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [strongWorkouts, strongExercises]);

  // Exercise progression & estimated 1RM
  const exerciseProgressionData = useMemo(() => {
    const exName = (selectedStatsEx || exerciseOptions[0] || '').toLowerCase().trim();
    if (!exName) return null;

    const sessions: { date: string; maxWeight: number; best1RM: number; totalVolume: number; setsCount: number }[] = [];
    const sortedWo = [...strongWorkouts].sort((a, b) => a.date.localeCompare(b.date));

    sortedWo.forEach(w => {
      const sets = (w.sets || []).filter(s => (s.exercise_name || '').toLowerCase().trim() === exName);
      if (sets.length === 0) return;

      let maxW = 0;
      let best1RM = 0;
      let vol = 0;

      sets.forEach(s => {
        const wVal = Number(s.weight) || 0;
        const rVal = Number(s.reps) || 0;
        if (wVal > maxW) maxW = wVal;
        const est1RM = rVal > 1 ? Math.round(wVal * (1 + rVal / 30) * 10) / 10 : wVal;
        if (est1RM > best1RM) best1RM = est1RM;
        vol += wVal * rVal;
      });

      sessions.push({
        date: w.date,
        maxWeight: maxW,
        best1RM,
        totalVolume: Math.round(vol),
        setsCount: sets.length
      });
    });

    return {
      exerciseName: selectedStatsEx || exerciseOptions[0],
      sessions,
      allTimeMax: sessions.length > 0 ? Math.max(...sessions.map(s => s.maxWeight)) : 0,
      allTime1RM: sessions.length > 0 ? Math.max(...sessions.map(s => s.best1RM)) : 0
    };
  }, [strongWorkouts, selectedStatsEx, exerciseOptions]);

  // Workout frequency heatmap (last 60 days)
  const frequencyDays = useMemo(() => {
    const workoutDates = new Set(strongWorkouts.map(w => w.date));
    const days: { dateStr: string; hasWorkout: boolean; dayOfWeek: number }[] = [];
    const now = new Date();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        dateStr,
        hasWorkout: workoutDates.has(dateStr),
        dayOfWeek: d.getDay()
      });
    }
    return days;
  }, [strongWorkouts]);

  // Filter workouts based on search query
  const filteredWorkouts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return strongWorkouts;

    return strongWorkouts.filter(w => {
      const nameMatch = (w.name || '').toLowerCase().includes(query);
      const dateMatch = (w.date || '').includes(query);
      const exerciseMatch = (w.sets || []).some(s => (s.exercise_name || '').toLowerCase().includes(query));
      return nameMatch || dateMatch || exerciseMatch;
    });
  }, [strongWorkouts, searchQuery]);

  // Page sliced workouts
  const visibleWorkouts = useMemo(() => {
    return filteredWorkouts.slice(0, pageSize);
  }, [filteredWorkouts, pageSize]);

  // Add a new exercise row to the current workout form
  const addExerciseToForm = (eName: string) => {
    if (!eName) return;
    setSelectedExercises(prev => [...prev, {
      exerciseName: eName,
      sets: [{ weight: '0', reps: '10' }]
    }]);
  };

  // Remove exercise from the form
  const removeExerciseFromForm = (index: number) => {
    setSelectedExercises(prev => prev.filter((_, i) => i !== index));
  };

  // Add set to an exercise in the form
  const addSetToExercise = (exIndex: number) => {
    setSelectedExercises(prev => {
      const next = [...prev];
      const targetEx = next[exIndex];
      const lastSet = targetEx.sets[targetEx.sets.length - 1] || { weight: '0', reps: '10' };
      targetEx.sets.push({ ...lastSet }); // Duplicate last set for convenience
      return next;
    });
  };

  // Remove set from an exercise in the form
  const removeSetFromExercise = (exIndex: number, setIndex: number) => {
    setSelectedExercises(prev => {
      const next = [...prev];
      const targetEx = next[exIndex];
      targetEx.sets = targetEx.sets.filter((_, i) => i !== setIndex);
      return next;
    });
  };

  // Handle set values change
  const handleSetChange = (exIndex: number, setIndex: number, field: 'weight' | 'reps', val: string) => {
    setSelectedExercises(prev => {
      const next = [...prev];
      next[exIndex].sets[setIndex][field] = val;
      return next;
    });
  };

  // Handle New Workout Submission
  const handleWorkoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorMsg('');
    setFormSuccessMsg('');

    if (selectedExercises.length === 0) {
      setFormErrorMsg('Veuillez ajouter au moins un exercice à cette séance.');
      return;
    }

    // Prepare sets
    const setsToLog: StrongWorkoutSet[] = [];
    selectedExercises.forEach(ex => {
      ex.sets.forEach((set, sIdx) => {
        setsToLog.push({
          exercise_name: ex.exerciseName,
          weight: parseFloat(set.weight) || 0,
          reps: parseInt(set.reps, 10) || 0,
          set_order: sIdx + 1
        });
      });
    });

    try {
      await addStrongWorkout({
        date: workoutDate,
        name: workoutName.trim() || "Entraînement de musculation",
        sets: setsToLog
      });

      setFormSuccessMsg('Séance enregistrée avec succès !');
      // Reset form
      setWorkoutDate(new Date().toISOString().split('T')[0]);
      setWorkoutName('Entraînement de musculation');
      setSelectedExercises([]);
      setTimeout(() => setFormSuccessMsg(''), 4000);
      setActiveSubTab('history');
    } catch (err: any) {
      setFormErrorMsg(err.message || "Erreur lors de l'enregistrement de la séance.");
    }
  };

  // Create new exercise definition
  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    setExErrorMsg('');
    setExSuccessMsg('');

    const trimmed = newExName.trim();
    if (!trimmed) {
      setExErrorMsg("Veuillez renseigner le nom de l'exercice.");
      return;
    }

    try {
      await addStrongExercise(trimmed);
      setExSuccessMsg('Exercice créé avec succès !');
      setNewExName('');
      setTimeout(() => setExSuccessMsg(''), 3000);
    } catch (err: any) {
      setExErrorMsg(err.message || "Erreur lors de la création.");
    }
  };

  // Pre-load from public/strong.csv
  const handlePreloadProjectCSV = async () => {
    setIsImporting(true);
    setImportSuccess('');
    setImportError('');
    try {
      const res = await fetch('./strong.csv');
      if (!res.ok) throw new Error("Le fichier public/strong.csv n'a pas pu être récupéré sur le serveur.");
      const csvText = await res.text();
      const { workoutsCount, exercisesCount, savedToCloud } = await importStrongCSVData(csvText);
      if (savedToCloud) {
        setImportSuccess(`Importation Cloud réussie ! ${workoutsCount} séances et ${exercisesCount} exercices ont été enregistrés dans votre base Supabase.`);
      } else {
        setImportSuccess(`Importation locale réussie (Sauvegarde locale uniquement) ! ${workoutsCount} séances et ${exercisesCount} exercices enregistrés dans ce navigateur.`);
      }
    } catch (err: any) {
      setImportError(err.message || "Erreur de chargement du fichier CSV.");
    } finally {
      setIsImporting(false);
    }
  };

  // Upload local CSV manual
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportSuccess('');
    setImportError('');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const { workoutsCount, exercisesCount, savedToCloud } = await importStrongCSVData(text);
        if (savedToCloud) {
          setImportSuccess(`Importation Cloud réussie ! ${workoutsCount} séances et ${exercisesCount} exercices enregistrés dans votre base Supabase.`);
        } else {
          setImportSuccess(`Importation locale réussie (Sauvegarde locale uniquement) ! ${workoutsCount} séances et ${exercisesCount} exercices enregistrés dans ce navigateur.`);
        }
      } catch (err: any) {
        setImportError(err.message || "Erreur de lecture du fichier.");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const sqlDDL = `-- SQL de migration pour Strong (Musculation).
-- À exécuter dans votre console de base de données Supabase (SQL Editor).

CREATE TABLE IF NOT EXISTS public.strong_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.strong_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.strong_workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID REFERENCES public.strong_workouts(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    set_order INTEGER NOT NULL,
    weight NUMERIC(6,2) NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.strong_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strong_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strong_workout_sets ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité RLS robustes
DROP POLICY IF EXISTS "Users can manage their own strong exercises" ON public.strong_exercises;
CREATE POLICY "Users can manage their own strong exercises" 
ON public.strong_exercises FOR ALL 
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own strong workouts" ON public.strong_workouts;
CREATE POLICY "Users can manage their own strong workouts" 
ON public.strong_workouts FOR ALL 
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own strong workout sets" ON public.strong_workout_sets;
CREATE POLICY "Users can manage their own strong workout sets" 
ON public.strong_workout_sets FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.strong_workouts 
        WHERE id = strong_workout_sets.workout_id AND (user_id = auth.uid() OR user_id IS NULL)
    )
    OR NOT EXISTS (
        SELECT 1 FROM public.strong_workouts WHERE id = strong_workout_sets.workout_id
    )
)
WITH CHECK (true);

-- Rattachement automatique de toute séance orpheline au compte connecté
UPDATE public.strong_workouts SET user_id = auth.uid() WHERE user_id IS NULL;
UPDATE public.strong_exercises SET user_id = auth.uid() WHERE user_id IS NULL;

-- Publication temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE public.strong_exercises, public.strong_workouts, public.strong_workout_sets;

CREATE INDEX IF NOT EXISTS idx_strong_workouts_user_date ON public.strong_workouts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_strong_workout_sets_workout ON public.strong_workout_sets(workout_id);`;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* CSS local style override */}
      <style>{`
        .strong-subtabs {
          display: flex;
          gap: 12px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 1px;
        }
        .strong-subtab-btn {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-med);
          font-weight: 600;
          font-size: 0.95rem;
          padding: 8px 16px;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .strong-subtab-btn.active {
          color: var(--accent-primary);
          border-bottom-color: var(--accent-primary);
        }
        .strong-subtab-btn:hover {
          color: #ffffff;
        }
        
        .workout-exercise-card {
          border-bottom: 1px solid rgba(255,255,255,0.04);
          padding: 12px 0;
        }
        .workout-exercise-card:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        
        .sets-grid-header {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 50px;
          gap: 12px;
          font-size: 0.72rem;
          color: var(--text-low);
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .sets-grid-row {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 50px;
          gap: 12px;
          align-items: center;
          margin-bottom: 6px;
        }
        
        .pr-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          background: rgba(234, 179, 8, 0.08);
          border: 1px solid rgba(234, 179, 8, 0.2);
          color: #eab308;
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 600;
        }
        
        .strong-subtabs {
          display: flex;
          gap: 12px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 1px;
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .strong-subtabs::-webkit-scrollbar {
          display: none;
        }
        
        .strong-stats-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        @media (max-width: 640px) {
          .strong-stats-kpis {
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }
          .sets-grid-header, .sets-grid-row {
            grid-template-columns: 60px 1fr 1fr 36px !important;
            gap: 6px !important;
          }
          .sets-grid-header {
            font-size: 0.65rem !important;
          }
          .sets-grid-row input {
            padding: 6px 4px !important;
            font-size: 0.8rem !important;
            min-width: 0 !important;
          }
          .strong-subtab-btn {
            padding: 8px 10px !important;
            font-size: 0.82rem !important;
            white-space: nowrap !important;
          }
        }
        @media (max-width: 1024px) {
          .strong-layout-grid {
            flex-direction: column !important;
          }
          .strong-panel-main, .strong-panel-side {
            flex: 1 1 100% !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Title */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Dumbbell style={{ color: 'var(--accent-primary)' }} />
          Suivi Musculation (Strong)
        </h1>
        <p style={{ color: 'var(--text-med)', fontSize: '0.95rem' }}>
          Gérez votre catalogue d'exercices, loggez vos séances et analysez vos records personnels de charge.
        </p>
      </div>

      {/* Top Main Section Switcher */}
      <div className="segmented-nav-container glass">
        <button
          onClick={() => setMainSection('workouts')}
          className="segmented-nav-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '50px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
            backgroundColor: mainSection === 'workouts' ? 'var(--accent-primary)' : 'transparent',
            color: mainSection === 'workouts' ? '#000000' : 'var(--text-med)',
            boxShadow: mainSection === 'workouts' ? 'var(--shadow-neon-primary)' : 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <Dumbbell size={16} />
          <span>Séances & Exercices</span>
        </button>

        <button
          onClick={() => setMainSection('stats')}
          className="segmented-nav-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '50px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
            backgroundColor: mainSection === 'stats' ? 'var(--accent-primary)' : 'transparent',
            color: mainSection === 'stats' ? '#000000' : 'var(--text-med)',
            boxShadow: mainSection === 'stats' ? 'var(--shadow-neon-primary)' : 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <BarChart3 size={16} />
          <span>Statistiques</span>
        </button>
      </div>

      {/* SECTION SÉANCES & EXERCICES */}
      {mainSection === 'workouts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sub Tabs Selection */}
          <div className="strong-subtabs">
        <button 
          onClick={() => setActiveSubTab('history')} 
          className={`strong-subtab-btn ${activeSubTab === 'history' ? 'active' : ''}`}
        >
          📅 Historique des Séances
        </button>
        <button 
          onClick={() => setActiveSubTab('add')} 
          className={`strong-subtab-btn ${activeSubTab === 'add' ? 'active' : ''}`}
        >
          ➕ Ajouter une Séance
        </button>
        <button 
          onClick={() => setActiveSubTab('exercises')} 
          className={`strong-subtab-btn ${activeSubTab === 'exercises' ? 'active' : ''}`}
        >
          💪 Exercices & Imports
        </button>
      </div>

      {/* Render View Based on sub-tab */}
      {activeSubTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* History control row */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-low)' }} />
              <input
                type="text"
                placeholder="Rechercher une séance, un exercice ou une date (ex: 2026-06)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px 12px 10px 38px',
                  fontSize: '0.85rem',
                  color: '#ffffff',
                  outline: 'none'
                }}
              />
            </div>
            
            <span style={{ fontSize: '0.82rem', color: 'var(--text-low)' }}>
              {filteredWorkouts.length} séance{filteredWorkouts.length > 1 ? 's' : ''} trouvée{filteredWorkouts.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* History Lists */}
          {visibleWorkouts.length === 0 ? (
            <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '60px', textAlign: 'center', color: 'var(--text-low)' }}>
              <Dumbbell size={48} style={{ color: 'var(--text-low)', marginBottom: '16px', opacity: 0.4 }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#ffffff' }}>Aucune séance de musculation enregistrée</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-low)', marginTop: '4px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                Vous pouvez créer des séances manuellement dans l'onglet **"Ajouter une Séance"** ou importer votre fichier csv historique dans l'onglet **"Exercices & Imports"**.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {visibleWorkouts.map(w => {
                const isExpanded = !!expandedWorkouts[w.id];
                
                // Group sets by exercise name to show structured exercises list
                const exerciseGroups: Record<string, StrongWorkoutSet[]> = {};
                const currentSets = w.sets || [];
                currentSets.forEach(s => {
                  if (!exerciseGroups[s.exercise_name]) {
                    exerciseGroups[s.exercise_name] = [];
                  }
                  exerciseGroups[s.exercise_name].push(s);
                });

                // Calculate summary stats
                const totalWeight = currentSets.reduce((acc, curr) => acc + (Number(curr.weight || 0) * Number(curr.reps || 0)), 0);
                const uniqueExercisesCount = Object.keys(exerciseGroups).length;

                return (
                  <div 
                    key={w.id} 
                    className="glass" 
                    style={{ 
                      borderRadius: 'var(--border-radius-lg)', 
                      border: isExpanded ? '1px solid rgba(168, 85, 247, 0.25)' : '1px solid var(--border-color)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Header */}
                    <div 
                      onClick={() => toggleWorkout(w.id)}
                      style={{ 
                        padding: '18px 20px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        backgroundColor: isExpanded ? 'rgba(168, 85, 247, 0.02)' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                            {w.name}
                          </span>
                          <span style={{ 
                            fontSize: '0.68rem', 
                            color: 'var(--accent-secondary)', 
                            backgroundColor: 'rgba(6, 182, 212, 0.06)',
                            border: '1px solid rgba(6, 182, 212, 0.15)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: 700
                          }}>
                            {uniqueExercisesCount} exo{uniqueExercisesCount > 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: 'var(--text-low)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={13} />
                            {w.date}
                          </span>
                          <span>•</span>
                          <span>Volume total : <strong>{totalWeight} kg</strong></span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Supprimer la séance du ${w.date} (${w.name}) ?`)) {
                              deleteStrongWorkout(w.id);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-low)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'var(--transition-fast)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.color = '#f43f5e';
                            e.currentTarget.style.backgroundColor = 'rgba(244,63,94,0.06)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.color = 'var(--text-low)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Trash2 size={15} />
                        </button>

                        <ChevronRight 
                          size={18} 
                          style={{ 
                            transform: isExpanded ? 'rotate(90deg)' : 'none', 
                            transition: 'transform 0.2s', 
                            color: 'var(--text-low)' 
                          }} 
                        />
                      </div>
                    </div>

                    {/* Collapsible Content */}
                    {isExpanded && (
                      <div style={{ 
                        padding: '0 20px 20px 20px', 
                        borderTop: '1px solid rgba(255,255,255,0.03)',
                        backgroundColor: 'rgba(0,0,0,0.08)'
                      }}>
                        {Object.entries(exerciseGroups).map(([exName, sets]) => (
                          <div key={exName} className="workout-exercise-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                                {exName}
                              </span>
                              
                              {/* Display PR status if achieved in this workout */}
                              {personalRecords[exName]?.date === w.date && (
                                <span className="pr-pill">
                                  <Trophy size={11} />
                                  PR ({personalRecords[exName].weight} kg)
                                </span>
                              )}
                            </div>

                            {/* Sets Table */}
                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                              {sets.map((set, sIdx) => (
                                <div 
                                  key={sIdx} 
                                  style={{ 
                                    fontSize: '0.8rem', 
                                    color: 'var(--text-med)',
                                    backgroundColor: 'rgba(255,255,255,0.02)',
                                    border: '1px solid var(--border-color)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    gap: '6px'
                                  }}
                                >
                                  <span style={{ color: 'var(--text-low)', fontWeight: 700 }}>#{sIdx+1}</span>
                                  <span>{set.weight} kg</span>
                                  <span style={{ color: 'var(--text-low)' }}>x</span>
                                  <span style={{ color: '#ffffff', fontWeight: 700 }}>{set.reps} reps</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pagination control */}
              {filteredWorkouts.length > pageSize && (
                <button
                  onClick={() => setPageSize(prev => prev + 30)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    color: '#ffffff',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '12px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'center',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                >
                  Afficher les séances précédentes (Charger 30 de plus)
                </button>
              )}
            </div>
          )}

        </div>
      )}

      {activeSubTab === 'add' && (
        <div className="strong-layout-grid" style={{ display: 'flex', gap: '24px' }}>
          
          {/* Main Form Panel (Left 65%) */}
          <div className="strong-panel-main" style={{ flex: '1 1 65%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px' }}>
              
              <form onSubmit={handleWorkoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Enregistrer un nouvel entraînement
                </h2>

                {formErrorMsg && (
                  <div style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#fca5a5', borderRadius: 'var(--border-radius-md)', padding: '12px', fontSize: '0.8rem' }}>
                    ⚠️ {formErrorMsg}
                  </div>
                )}
                {formSuccessMsg && (
                  <div style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#a7f3d0', borderRadius: 'var(--border-radius-md)', padding: '12px', fontSize: '0.8rem' }}>
                    ✔️ {formSuccessMsg}
                  </div>
                )}

                {/* Date and Workout Name Row */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 180px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-med)' }}>Date de la séance</label>
                    <input
                      type="date"
                      value={workoutDate}
                      onChange={(e) => setWorkoutDate(e.target.value)}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--border-radius-md)',
                        padding: '10px 12px',
                        fontSize: '0.85rem',
                        color: '#ffffff',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '2 1 280px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-med)' }}>Nom / Template de séance</label>
                    <input
                      type="text"
                      value={workoutName}
                      onChange={(e) => setWorkoutName(e.target.value)}
                      placeholder="Ex: Leg Day, Pectoraux/Triceps..."
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--border-radius-md)',
                        padding: '10px 12px',
                        fontSize: '0.85rem',
                        color: '#ffffff',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Selected Exercises to Log */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    Exercices de la séance ({selectedExercises.length})
                  </h3>

                  {selectedExercises.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--border-radius-md)', color: 'var(--text-low)', fontSize: '0.82rem' }}>
                      Aucun exercice sélectionné. Choisissez un exercice dans le panneau de droite.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {selectedExercises.map((ex, exIdx) => (
                        <div 
                          key={exIdx} 
                          style={{ 
                            backgroundColor: 'rgba(255,255,255,0.01)', 
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--border-radius-md)',
                            padding: '16px'
                          }}
                        >
                          {/* Exercise name row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                              {ex.exerciseName}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeExerciseFromForm(exIdx)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-low)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.color = '#f43f5e'}
                              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-low)'}
                            >
                              Retirer
                            </button>
                          </div>

                          {/* Sets table fields */}
                          <div className="sets-grid-header">
                            <span>Série</span>
                            <span>Poids (kg)</span>
                            <span>Répétitions</span>
                            <span></span>
                          </div>

                          {ex.sets.map((set, sIdx) => (
                            <div key={sIdx} className="sets-grid-row">
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-low)' }}>
                                #{sIdx + 1}
                              </span>
                              
                              <input
                                type="number"
                                step="0.25"
                                value={set.weight}
                                onChange={(e) => handleSetChange(exIdx, sIdx, 'weight', e.target.value)}
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 'var(--border-radius-sm)',
                                  padding: '6px 8px',
                                  fontSize: '0.8rem',
                                  color: '#ffffff',
                                  width: '100%',
                                  outline: 'none'
                                }}
                              />

                              <input
                                type="number"
                                value={set.reps}
                                onChange={(e) => handleSetChange(exIdx, sIdx, 'reps', e.target.value)}
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 'var(--border-radius-sm)',
                                  padding: '6px 8px',
                                  fontSize: '0.8rem',
                                  color: '#ffffff',
                                  width: '100%',
                                  outline: 'none'
                                }}
                              />

                              <button
                                type="button"
                                onClick={() => removeSetFromExercise(exIdx, sIdx)}
                                disabled={ex.sets.length === 1}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: ex.sets.length === 1 ? 'transparent' : 'var(--text-low)',
                                  cursor: ex.sets.length === 1 ? 'default' : 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onMouseOver={(e) => {
                                  if (ex.sets.length > 1) e.currentTarget.style.color = '#f43f5e';
                                }}
                                onMouseOut={(e) => {
                                  if (ex.sets.length > 1) e.currentTarget.style.color = 'var(--text-low)';
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}

                          {/* Add Set Btn */}
                          <button
                            type="button"
                            onClick={() => addSetToExercise(exIdx)}
                            style={{
                              background: 'rgba(255,255,255,0.01)',
                              border: '1px dashed var(--border-color)',
                              borderRadius: 'var(--border-radius-sm)',
                              color: 'var(--text-med)',
                              padding: '6px 12px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              width: '100%',
                              marginTop: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'}
                          >
                            <Copy size={12} />
                            Ajouter une Série (Dupliquer)
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '12px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: 'var(--shadow-neon-primary)',
                    transition: 'brightness 0.2s',
                    marginTop: '10px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                  onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                >
                  <Plus size={16} />
                  Enregistrer l'Entraînement
                </button>
              </form>

            </div>
          </div>

          {/* Exercise Selection Panel (Right 35%) */}
          <div className="strong-panel-side" style={{ flex: '1 1 35%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', margin: '0 0 14px 0' }}>
                Sélectionner un Exercice
              </h3>

              {strongExercises.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-low)', fontStyle: 'italic', margin: 0 }}>
                  Aucun exercice enregistré. Allez dans l'onglet "Exercices & Imports" pour en créer ou importer.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                  {strongExercises.map(ex => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => addExerciseToForm(ex.name)}
                      className="glass-interactive"
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: 'var(--border-radius-md)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(255,255,255,0.01)'
                      }}
                    >
                      <span>{ex.name}</span>
                      <Plus size={14} style={{ color: 'var(--accent-secondary)' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {activeSubTab === 'exercises' && (
        <div className="strong-layout-grid" style={{ display: 'flex', gap: '24px' }}>
          
          {/* Exercises catalog panel (Left 60%) */}
          <div className="strong-panel-main" style={{ flex: '1 1 58%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
                Catalogue d'Exercices ({strongExercises.length})
              </h3>

              {strongExercises.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-low)', fontStyle: 'italic' }}>
                  Votre catalogue d'exercices est vide. Créez un exercice manuellement à droite ou chargez le CSV historique.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                  {strongExercises.map(ex => {
                    const pr = personalRecords[ex.name];
                    return (
                      <div 
                        key={ex.id} 
                        style={{ 
                          padding: '14px', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: 'var(--border-radius-md)',
                          backgroundColor: 'rgba(255,255,255,0.01)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                            {ex.name}
                          </span>
                          <button
                            onClick={() => {
                              if (window.confirm(`Supprimer l'exercice "${ex.name}" ?`)) {
                                deleteStrongExercise(ex.id);
                              }
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-low)',
                              cursor: 'pointer',
                              padding: '2px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#f43f5e'}
                            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-low)'}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        
                        {/* Display Max Record */}
                        {pr ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 'auto' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-low)', textTransform: 'uppercase', fontWeight: 700 }}>Record Personnel</span>
                            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Trophy size={12} />
                              {pr.weight} kg x {pr.reps} reps
                            </span>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-low)' }}>Atteint le {pr.date}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-low)', fontStyle: 'italic', marginTop: 'auto' }}>
                            Aucun historique enregistré
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Operations forms (Right 40%) */}
          <div className="strong-panel-side" style={{ flex: '1 1 40%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Create manual exercise form */}
            <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px' }}>
              <form onSubmit={handleCreateExercise} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Créer un exercice
                </h3>

                {exErrorMsg && (
                  <div style={{ color: '#fca5a5', fontSize: '0.72rem' }}>⚠️ {exErrorMsg}</div>
                )}
                {exSuccessMsg && (
                  <div style={{ color: '#a7f3d0', fontSize: '0.72rem' }}>✔️ {exSuccessMsg}</div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-med)', fontWeight: 600 }}>Nom de l'exercice</label>
                  <input
                    type="text"
                    value={newExName}
                    onChange={(e) => setNewExName(e.target.value)}
                    placeholder="Ex: Bench Press (Barbell), Squat..."
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius-md)',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    boxShadow: 'var(--shadow-neon-primary)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                  onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                >
                  <Plus size={14} />
                  Créer l'exercice
                </button>
              </form>
            </div>

            {/* CSV Import card */}
            <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Upload size={15} style={{ color: 'var(--accent-secondary)' }} />
                Importer les Données Historiques
              </h3>

              <p style={{ fontSize: '0.72rem', color: 'var(--text-low)', margin: 0, lineHeight: 1.3 }}>
                Vous pouvez pré-charger directement le fichier d'historique `strong.csv` copié dans les fichiers du projet, ou sélectionner manuellement un fichier CSV exporté de l'application Strong.
              </p>

              {importError && (
                <div style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#fca5a5', borderRadius: '4px', padding: '10px', fontSize: '0.72rem' }}>
                  ⚠️ {importError}
                </div>
              )}
              {importSuccess && (
                <div style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#a7f3d0', borderRadius: '4px', padding: '10px', fontSize: '0.72rem' }}>
                  ✔️ {importSuccess}
                </div>
              )}

              {/* Preload Project File btn */}
              <button
                type="button"
                onClick={handlePreloadProjectCSV}
                disabled={isImporting}
                style={{
                  backgroundColor: 'var(--accent-secondary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: isImporting ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 0 10px rgba(6, 182, 212, 0.2)',
                  transition: 'brightness 0.2s',
                  opacity: isImporting ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (!isImporting) e.currentTarget.style.filter = 'brightness(1.15)';
                }}
                onMouseOut={(e) => {
                  if (!isImporting) e.currentTarget.style.filter = 'none';
                }}
              >
                <Sparkles size={14} />
                {isImporting ? 'Importation en cours...' : 'Pré-charger depuis strong.csv'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
                <span style={{ fontSize: '0.62rem', color: 'var(--text-low)', textTransform: 'uppercase' }}>ou</span>
                <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
              </div>

              {/* Custom manual file input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-low)', fontWeight: 600 }}>Importer un fichier local .csv</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={isImporting}
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-med)',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>

            {/* SQL guide fold */}
            {isSupabaseConnected && (
              <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '20px' }}>
                <button
                  onClick={() => setShowSqlGuide(!showSqlGuide)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={15} style={{ color: 'var(--accent-secondary)' }} />
                    Polices & Tables Supabase
                  </span>
                  <ChevronRight 
                    size={16} 
                    style={{ 
                      transform: showSqlGuide ? 'rotate(90deg)' : 'none', 
                      transition: 'transform 0.2s ease', 
                      color: 'var(--text-low)' 
                    }} 
                  />
                </button>

                {showSqlGuide && (
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-low)', margin: 0, lineHeight: 1.3 }}>
                      Si les tables Supabase ne sont pas créées, les séances enregistrées et les imports de CSV persisteront sur votre stockage local sans risque d'erreur. Si vous préférez la synchronisation cloud, exécutez ce script :
                    </p>
                    
                    <div style={{ position: 'relative', marginTop: '6px' }}>
                      <pre style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '10px',
                        fontSize: '0.6rem',
                        color: '#a7f3d0',
                        overflowX: 'auto',
                        maxHeight: '180px',
                        fontFamily: 'monospace',
                        margin: 0
                      }}>
                        {sqlDDL}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      )}

      </div>
      )}

      {/* SECTION STATISTIQUES & PROGRESSION */}
      {mainSection === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* KPI Summary Cards */}
          <div className="strong-stats-kpis">
            <div className="glass" style={{ borderRadius: 'var(--border-radius-md)', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-med)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Séances Totales
                </span>
                <Dumbbell size={16} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
                {globalStrongStats.totalWorkouts}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-low)' }}>
                enregistrées au total
              </span>
            </div>

            <div className="glass" style={{ borderRadius: 'var(--border-radius-md)', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-med)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Séries Validées
                </span>
                <Activity size={16} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
                {globalStrongStats.totalSets}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-low)' }}>
                séries de travail effectives
              </span>
            </div>

            <div className="glass" style={{ borderRadius: 'var(--border-radius-md)', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-med)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Tonnage Cumulé
                </span>
                <Flame size={16} style={{ color: '#f59e0b' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
                {globalStrongStats.tonnageTonnes} <span style={{ fontSize: '0.9rem', color: 'var(--accent-primary)' }}>Tonnes</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-low)' }}>
                {globalStrongStats.totalTonnage.toLocaleString('fr-FR')} kg soulevés
              </span>
            </div>

            <div className="glass" style={{ borderRadius: 'var(--border-radius-md)', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-med)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Exercices Travaillés
                </span>
                <Trophy size={16} style={{ color: '#eab308' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
                {exerciseOptions.length}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-low)' }}>
                exercices uniques au catalogue
              </span>
            </div>
          </div>

          {/* Section 1: Weekly Volume & Tonnage SVG Chart */}
          <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
                  Volume Hebdomadaire (8 Dernières Semaines)
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-med)', margin: '4px 0 0 0' }}>
                  Suivez votre surcharge progressive et le volume cumulé par semaine.
                </p>
              </div>

              {/* Metric Switcher: Tonnage vs Sets */}
              <div style={{ display: 'inline-flex', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '50px', padding: '3px', border: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => setStatsMetric('tonnage')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '50px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: statsMetric === 'tonnage' ? 700 : 500,
                    cursor: 'pointer',
                    backgroundColor: statsMetric === 'tonnage' ? 'var(--accent-primary)' : 'transparent',
                    color: statsMetric === 'tonnage' ? '#000000' : 'var(--text-med)',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  Tonnage (kg)
                </button>
                <button
                  onClick={() => setStatsMetric('sets')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '50px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: statsMetric === 'sets' ? 700 : 500,
                    cursor: 'pointer',
                    backgroundColor: statsMetric === 'sets' ? 'var(--accent-primary)' : 'transparent',
                    color: statsMetric === 'sets' ? '#000000' : 'var(--text-med)',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  Nombre de Séries
                </button>
              </div>
            </div>

            {/* SVG Bar Chart */}
            <div style={{ width: '100%', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
              {(() => {
                const maxVal = Math.max(...weeklyVolumeData.map(w => statsMetric === 'tonnage' ? w.tonnage : w.sets), 1);
                const svgW = 620;
                const svgH = 200;
                const padX = 35;
                const padBottom = 35;
                const padTop = 25;
                const chartH = svgH - padBottom - padTop;
                const n = weeklyVolumeData.length;
                const colW = (svgW - 2 * padX) / n;
                const barW = Math.min(colW * 0.55, 36);

                return (
                  <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                    {/* Horizontal grid lines */}
                    {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                      const y = padTop + chartH * (1 - ratio);
                      const gridVal = Math.round(maxVal * ratio);
                      return (
                        <g key={idx}>
                          <line x1={padX} y1={y} x2={svgW - padX} y2={y} stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" />
                          <text x={padX - 6} y={y + 3} textAnchor="end" fill="var(--text-low)" fontSize="9">
                            {statsMetric === 'tonnage' && gridVal >= 1000 ? `${(gridVal / 1000).toFixed(1)}k` : gridVal}
                          </text>
                        </g>
                      );
                    })}

                    {/* Bars */}
                    {weeklyVolumeData.map((w, idx) => {
                      const val = statsMetric === 'tonnage' ? w.tonnage : w.sets;
                      const barH = maxVal > 0 ? (val / maxVal) * chartH : 0;
                      const x = padX + idx * colW + (colW - barW) / 2;
                      const y = padTop + chartH - barH;
                      const isHovered = hoveredWeek?.label === w.label;

                      return (
                        <g 
                          key={w.label}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredWeek(w)}
                          onMouseLeave={() => setHoveredWeek(null)}
                        >
                          {/* Background hover bar highlight */}
                          <rect
                            x={padX + idx * colW}
                            y={padTop}
                            width={colW}
                            height={chartH}
                            fill={isHovered ? 'rgba(255, 255, 255, 0.03)' : 'transparent'}
                            rx="4"
                          />

                          {/* Data bar */}
                          <rect
                            x={x}
                            y={val > 0 ? y : padTop + chartH - 2}
                            width={barW}
                            height={val > 0 ? barH : 2}
                            fill={isHovered ? '#60a5fa' : 'var(--accent-primary)'}
                            rx="4"
                            style={{ transition: 'all 0.2s ease' }}
                          />

                          {/* Value label above bar if non-zero */}
                          {val > 0 && (
                            <text
                              x={x + barW / 2}
                              y={y - 6}
                              textAnchor="middle"
                              fill={isHovered ? '#ffffff' : 'var(--text-med)'}
                              fontSize="10"
                              fontWeight="700"
                            >
                              {statsMetric === 'tonnage' ? (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val) : val}
                            </text>
                          )}

                          {/* Week label below bar */}
                          <text
                            x={x + barW / 2}
                            y={svgH - 12}
                            textAnchor="middle"
                            fill={isHovered ? '#ffffff' : 'var(--text-low)'}
                            fontSize="9"
                            fontWeight={isHovered ? '700' : '500'}
                          >
                            {w.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>

            {/* Hovered Week Details banner */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-sm)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
              color: 'var(--text-med)'
            }}>
              {hoveredWeek ? (
                <>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>
                    Semaine du {hoveredWeek.label} :
                  </span>
                  <span>🏋️ <strong>{hoveredWeek.workouts}</strong> séance{hoveredWeek.workouts > 1 ? 's' : ''}</span>
                  <span>🔢 <strong>{hoveredWeek.sets}</strong> séries</span>
                  <span>⚖️ <strong>{hoveredWeek.tonnage.toLocaleString('fr-FR')} kg</strong> soulevés</span>
                </>
              ) : (
                <span style={{ color: 'var(--text-low)', fontSize: '0.78rem' }}>
                  Survolez une barre pour inspecter le détail des séances, séries et charge de la semaine.
                </span>
              )}
            </div>
          </div>

          {/* Section 2: Frequency & Consistency Heatmap */}
          <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={18} style={{ color: '#f59e0b' }} />
                Régularité des Entraînements (60 Derniers Jours)
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-med)' }}>
                {frequencyDays.filter(d => d.hasWorkout).length} séances effectuées
              </span>
            </div>

            {/* Heatmap Grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 0' }}>
              {frequencyDays.map(d => (
                <div
                  key={d.dateStr}
                  title={`${d.dateStr} : ${d.hasWorkout ? 'Séance effectuée ✓' : 'Repos'}`}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    backgroundColor: d.hasWorkout ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                    border: d.hasWorkout ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: d.hasWorkout ? '0 0 6px rgba(129, 140, 248, 0.35)' : 'none',
                    transition: 'transform 0.15s ease'
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.72rem', color: 'var(--text-low)', marginTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }} />
                <span>Repos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--accent-primary)' }} />
                <span>Séance Strong</span>
              </div>
            </div>
          </div>

          {/* Section 3: Exercise Progression & 1RM Curve */}
          <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} style={{ color: '#eab308' }} />
                  Progression par Exercice & Record 1RM
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-med)', margin: '4px 0 0 0' }}>
                  Analysez l'évolution de vos charges maximales et de votre 1RM estimé (formule d'Epley) séance après séance.
                </p>
              </div>

              {/* Exercise Selector */}
              {exerciseOptions.length > 0 && (
                <div style={{ minWidth: '220px' }}>
                  <select
                    value={selectedStatsEx || exerciseOptions[0] || ''}
                    onChange={(e) => setSelectedStatsEx(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--border-radius-sm)',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-color)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {exerciseOptions.map(name => (
                      <option key={name} value={name} style={{ backgroundColor: '#1a1d24', color: '#ffffff' }}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {exerciseProgressionData && exerciseProgressionData.sessions.length > 0 ? (
              <>
                {/* Exercise PR Highlights */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                  <div className="glass" style={{ borderRadius: 'var(--border-radius-sm)', padding: '14px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-med)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Record Absolu (Charge Max)
                    </span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#eab308', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Trophy size={18} />
                      <span>{exerciseProgressionData.allTimeMax} kg</span>
                    </div>
                  </div>

                  <div className="glass" style={{ borderRadius: 'var(--border-radius-sm)', padding: '14px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-med)', textTransform: 'uppercase', fontWeight: 700 }}>
                      1RM Estimé Max
                    </span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                      {exerciseProgressionData.allTime1RM} kg
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-low)' }}>
                      Formule: Charge × (1 + Reps/30)
                    </span>
                  </div>

                  <div className="glass" style={{ borderRadius: 'var(--border-radius-sm)', padding: '14px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-med)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Séances Enregistrées
                    </span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                      {exerciseProgressionData.sessions.length}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-low)' }}>
                      historique complet
                    </span>
                  </div>
                </div>

                {/* SVG Progression Line Chart */}
                {(() => {
                  const sessions = exerciseProgressionData.sessions;
                  if (sessions.length < 2) {
                    return (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-med)', fontSize: '0.85rem' }}>
                        Une seule séance répertoriée pour cet exercice ({sessions[0].maxWeight} kg le {sessions[0].date}). Loggez davantage de séances pour afficher la courbe de progression.
                      </div>
                    );
                  }

                  const svgW = 640;
                  const svgH = 220;
                  const padLeft = 40;
                  const padRight = 30;
                  const padTop = 30;
                  const padBottom = 40;
                  const plotW = svgW - padLeft - padRight;
                  const plotH = svgH - padTop - padBottom;

                  const weights = sessions.map(s => s.maxWeight);
                  const minW = Math.max(0, Math.floor(Math.min(...weights) * 0.9));
                  const maxW = Math.ceil(Math.max(...weights) * 1.05) || 10;
                  const rangeW = maxW - minW || 1;

                  const points = sessions.map((s, idx) => {
                    const x = padLeft + (idx / (sessions.length - 1)) * plotW;
                    const y = padTop + plotH - ((s.maxWeight - minW) / rangeW) * plotH;
                    return { x, y, session: s };
                  });

                  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${padTop + plotH} L ${points[0].x.toFixed(1)} ${padTop + plotH} Z`;

                  return (
                    <div style={{ width: '100%', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
                      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                        <defs>
                          <linearGradient id="exProgGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#eab308" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#eab308" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Y Grid lines */}
                        {[0, 0.5, 1].map((ratio, idx) => {
                          const y = padTop + plotH * (1 - ratio);
                          const val = Math.round(minW + rangeW * ratio);
                          return (
                            <g key={idx}>
                              <line x1={padLeft} y1={y} x2={svgW - padRight} y2={y} stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" />
                              <text x={padLeft - 6} y={y + 3} textAnchor="end" fill="var(--text-low)" fontSize="9">
                                {val}kg
                              </text>
                            </g>
                          );
                        })}

                        {/* Area */}
                        <path d={areaPath} fill="url(#exProgGrad)" />

                        {/* Line */}
                        <path d={linePath} fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Points */}
                        {points.map((p, idx) => {
                          const isHovered = hoveredExPoint?.date === p.session.date;
                          const isPR = p.session.maxWeight === exerciseProgressionData.allTimeMax;

                          return (
                            <g 
                              key={idx}
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={() => setHoveredExPoint(p.session)}
                              onMouseLeave={() => setHoveredExPoint(null)}
                            >
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={isHovered ? 6 : isPR ? 5 : 3.5}
                                fill={isPR ? '#eab308' : '#ffffff'}
                                stroke="#1a1d24"
                                strokeWidth="2"
                              />
                            </g>
                          );
                        })}

                        {/* X-axis date labels for first, middle and last */}
                        {points.length > 0 && (
                          <>
                            <text x={points[0].x} y={svgH - 12} textAnchor="start" fill="var(--text-low)" fontSize="9">
                              {points[0].session.date}
                            </text>
                            {points.length > 2 && (
                              <text x={points[Math.floor(points.length / 2)].x} y={svgH - 12} textAnchor="middle" fill="var(--text-low)" fontSize="9">
                                {points[Math.floor(points.length / 2)].session.date}
                              </text>
                            )}
                            <text x={points[points.length - 1].x} y={svgH - 12} textAnchor="end" fill="var(--text-low)" fontSize="9">
                              {points[points.length - 1].session.date}
                            </text>
                          </>
                        )}
                      </svg>

                      {/* Tooltip display */}
                      {hoveredExPoint && (
                        <div style={{
                          marginTop: '8px',
                          backgroundColor: 'rgba(234, 179, 8, 0.08)',
                          border: '1px solid rgba(234, 179, 8, 0.25)',
                          borderRadius: 'var(--border-radius-sm)',
                          padding: '8px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.82rem',
                          color: '#ffffff'
                        }}>
                          <span>Séance du <strong>{hoveredExPoint.date}</strong></span>
                          <span>Charge max : <strong style={{ color: '#eab308' }}>{hoveredExPoint.maxWeight} kg</strong></span>
                          <span>1RM estimé : <strong style={{ color: '#38bdf8' }}>{hoveredExPoint.best1RM} kg</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Historical Sessions Table */}
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-med)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                    Détail des dernières séances ({selectedStatsEx || exerciseOptions[0]}) :
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[...exerciseProgressionData.sessions].reverse().slice(0, 8).map(s => {
                      const isPR = s.maxWeight === exerciseProgressionData.allTimeMax;
                      return (
                        <div
                          key={s.date}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            padding: '8px 12px',
                            backgroundColor: isPR ? 'rgba(234, 179, 8, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                            border: isPR ? '1px solid rgba(234, 179, 8, 0.2)' : '1px solid var(--border-color)',
                            borderRadius: 'var(--border-radius-sm)',
                            fontSize: '0.82rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={13} style={{ color: 'var(--text-low)' }} />
                            <span style={{ fontWeight: 600, color: '#ffffff' }}>{s.date}</span>
                            {isPR && (
                              <span className="pr-pill">
                                <Trophy size={11} />
                                Record
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <span>Max: <strong style={{ color: '#ffffff' }}>{s.maxWeight} kg</strong></span>
                            <span>1RM: <strong style={{ color: '#38bdf8' }}>{s.best1RM} kg</strong></span>
                            <span style={{ color: 'var(--text-low)' }}>{s.setsCount} série{s.setsCount > 1 ? 's' : ''} ({s.totalVolume} kg vol.)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-med)' }}>
                <Dumbbell size={36} style={{ color: 'var(--accent-primary)', opacity: 0.4, marginBottom: '12px' }} />
                <p style={{ fontSize: '0.9rem', margin: 0 }}>
                  Aucune séance trouvée pour cet exercice.
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-low)', marginTop: '4px' }}>
                  Sélectionnez un autre exercice ou enregistrez une séance pour visualiser votre courbe de progression.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};

