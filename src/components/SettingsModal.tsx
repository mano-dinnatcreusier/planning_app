import React, { useState } from 'react';
import { useGoals } from '../context/GoalContext';
import { Database, X, CheckCircle, AlertTriangle, Copy, Check, Sparkles, User, LogOut, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  openLogin?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, openLogin }) => {
  const {
    supabaseConfig,
    isSupabaseConnected,
    saveSupabaseConfig,
    aiConfig,
    saveAiConfig,
    clearDatabase,
    loadDemoData,
    user,
    logout,
    syncCloudNow
  } = useGoals();

  const [url, setUrl] = useState(supabaseConfig.url);
  const [anonKey, setAnonKey] = useState(supabaseConfig.anonKey);
  const [aiUrl, setAiUrl] = useState(aiConfig.url);
  const [aiApiKey, setAiApiKey] = useState(aiConfig.apiKey);
  const [aiModel, setAiModel] = useState(aiConfig.model);
  const [copied, setCopied] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      await syncCloudNow();
      setSyncFeedback("Synchronisation réussie !");
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err: any) {
      setSyncFeedback("Échec de la synchronisation.");
      setTimeout(() => setSyncFeedback(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    // Save configurations
    const dbSuccess = await saveSupabaseConfig(url, anonKey);
    await saveAiConfig(aiUrl, aiApiKey, aiModel);

    if (url && anonKey) {
      if (dbSuccess) {
        setStatusMessage({ text: 'Configuration DB & IA enregistrée et connectée !', error: false });
        setTimeout(() => onClose(), 1500);
      } else {
        setStatusMessage({ text: 'Échec de la connexion Supabase. Vérifiez les informations.', error: true });
      }
    } else {
      setStatusMessage({ text: 'Configuration IA enregistrée avec succès (Mode Démo Local actif).', error: false });
      setTimeout(() => onClose(), 1500);
    }
  };

  const handleDisconnect = async () => {
    await saveSupabaseConfig('', '');
    setUrl('');
    setAnonKey('');
    setStatusMessage({ text: 'Déconnecté de Supabase. Retour au mode LocalStorage.', error: false });
  };

  const copyMigrationSQL = () => {
    const sql = `-- Ajouter les colonnes de scoring aux objectifs
ALTER TABLE public.final_goals ADD COLUMN IF NOT EXISTS est_hours INTEGER DEFAULT 10;
ALTER TABLE public.final_goals ADD COLUMN IF NOT EXISTS perceived_difficulty INTEGER DEFAULT 3;
ALTER TABLE public.final_goals ADD COLUMN IF NOT EXISTS coeff_public NUMERIC(3,2) DEFAULT 1.5;
ALTER TABLE public.final_goals ADD COLUMN IF NOT EXISTS coeff_personal NUMERIC(3,2) DEFAULT 1.0;
ALTER TABLE public.final_goals ADD COLUMN IF NOT EXISTS points_absolute INTEGER DEFAULT 150;
ALTER TABLE public.final_goals ADD COLUMN IF NOT EXISTS points_relative INTEGER DEFAULT 150;
ALTER TABLE public.final_goals ADD COLUMN IF NOT EXISTS user_start_context TEXT;
ALTER TABLE public.final_goals ADD COLUMN IF NOT EXISTS ai_explanation TEXT;
ALTER TABLE public.final_goals ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'));

-- Ajouter les colonnes de scoring aux jalons
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS est_hours INTEGER DEFAULT 2;
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS perceived_difficulty INTEGER DEFAULT 3;
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS points_absolute INTEGER DEFAULT 30;
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS points_relative INTEGER DEFAULT 30;
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'));

-- Ajouter le support multi-utilisateurs (Système de Connexion)
ALTER TABLE public.final_goals ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS user_id UUID;

-- Créer la table des profils utilisateurs
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID PRIMARY KEY,
    ai_api_key TEXT,
    ai_model TEXT DEFAULT 'deepseek-chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);`;

    navigator.clipboard.writeText(sql);
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 2000);
  };

  const copySQL = () => {
    const sql = `-- Table des Objectifs Finaux
CREATE TABLE final_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    difficulty INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    target_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    est_hours INTEGER DEFAULT 10,
    perceived_difficulty INTEGER DEFAULT 3,
    coeff_public NUMERIC(3,2) DEFAULT 1.5,
    coeff_personal NUMERIC(3,2) DEFAULT 1.0,
    points_absolute INTEGER DEFAULT 150,
    points_relative INTEGER DEFAULT 150,
    user_start_context TEXT,
    ai_explanation TEXT,
    user_id UUID
);

-- Table des Jalons (Milestones)
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    final_goal_id UUID REFERENCES final_goals(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    difficulty INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    order_index INTEGER DEFAULT 0,
    target_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    est_hours INTEGER DEFAULT 2,
    perceived_difficulty INTEGER DEFAULT 3,
    points_absolute INTEGER DEFAULT 30,
    points_relative INTEGER DEFAULT 30
);

-- Table des Sous-tâches
CREATE TABLE subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Table des Habitudes (Routines)
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL,
    frequency_type TEXT NOT NULL CHECK (frequency_type IN ('daily', 'weekly', 'custom')),
    custom_days_per_week INTEGER,
    goal_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    user_id UUID
);

-- Table des logs de validation d'habitudes
CREATE TABLE IF NOT EXISTS habit_logs (
    habit_id UUID REFERENCES habits(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('done', 'missed')),
    PRIMARY KEY (habit_id, date)
);

-- Table des profils utilisateurs (IA configuration cloud)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY,
    ai_api_key TEXT,
    ai_model TEXT DEFAULT 'deepseek-chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Table des Indicateurs de Suivi (Trackers)
CREATE TABLE IF NOT EXISTS public.trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    periodicity TEXT NOT NULL,
    unit TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Table des journaux de suivi
CREATE TABLE IF NOT EXISTS public.tracker_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracker_id UUID REFERENCES public.trackers(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tables de Musculation Strong
CREATE TABLE IF NOT EXISTS public.strong_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.strong_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.strong_workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID REFERENCES public.strong_workouts(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    set_order INTEGER NOT NULL,
    weight NUMERIC NOT NULL,
    reps INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Activation de la sécurité RLS
ALTER TABLE public.final_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracker_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strong_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strong_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strong_workout_sets ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité RLS
DROP POLICY IF EXISTS "Users can manage their own final goals" ON public.final_goals;
CREATE POLICY "Users can manage their own final goals" ON public.final_goals FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own milestones" ON public.milestones;
CREATE POLICY "Users can manage their own milestones" ON public.milestones FOR ALL USING (
    EXISTS (SELECT 1 FROM public.final_goals WHERE id = milestones.final_goal_id AND (user_id = auth.uid() OR user_id IS NULL))
    OR NOT EXISTS (SELECT 1 FROM public.final_goals WHERE id = milestones.final_goal_id)
) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own subtasks" ON public.subtasks;
CREATE POLICY "Users can manage their own subtasks" ON public.subtasks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own habits" ON public.habits;
CREATE POLICY "Users can manage their own habits" ON public.habits FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own habit logs" ON public.habit_logs;
CREATE POLICY "Users can manage their own habit logs" ON public.habit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own trackers" ON public.trackers;
CREATE POLICY "Users can manage their own trackers" ON public.trackers FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own tracker logs" ON public.tracker_logs;
CREATE POLICY "Users can manage their own tracker logs" ON public.tracker_logs FOR ALL USING (
    EXISTS (SELECT 1 FROM public.trackers WHERE id = tracker_logs.tracker_id AND (user_id = auth.uid() OR user_id IS NULL))
    OR NOT EXISTS (SELECT 1 FROM public.trackers WHERE id = tracker_logs.tracker_id)
) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own strong exercises" ON public.strong_exercises;
CREATE POLICY "Users can manage their own strong exercises" ON public.strong_exercises FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own strong workouts" ON public.strong_workouts;
CREATE POLICY "Users can manage their own strong workouts" ON public.strong_workouts FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own strong workout sets" ON public.strong_workout_sets;
CREATE POLICY "Users can manage their own strong workout sets" ON public.strong_workout_sets FOR ALL USING (
    EXISTS (SELECT 1 FROM public.strong_workouts WHERE id = strong_workout_sets.workout_id AND (user_id = auth.uid() OR user_id IS NULL))
    OR NOT EXISTS (SELECT 1 FROM public.strong_workouts WHERE id = strong_workout_sets.workout_id)
) WITH CHECK (true);

-- Rattachement automatique de toute séance orpheline au compte connecté
UPDATE public.strong_workouts SET user_id = auth.uid() WHERE user_id IS NULL;
UPDATE public.strong_exercises SET user_id = auth.uid() WHERE user_id IS NULL;

-- Publication temps réel (Supabase Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE public.final_goals, public.milestones, public.subtasks, public.habits, public.habit_logs, public.trackers, public.tracker_logs, public.strong_exercises, public.strong_workouts, public.strong_workout_sets;`;

    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(3, 4, 8, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      className="animate-fade-in"
    >
      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: '650px',
          maxHeight: '90vh',
          borderRadius: 'var(--border-radius-lg)',
          overflowY: 'auto',
          position: 'relative',
          padding: '30px',
          animation: 'slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              padding: '10px',
              borderRadius: 'var(--border-radius-md)',
              color: 'var(--accent-primary)',
              boxShadow: 'var(--shadow-neon-primary)'
            }}>
              <Database size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Configuration Base de Données</h2>
              <p style={{ color: 'var(--text-med)', fontSize: '0.85rem', marginTop: '2px' }}>Intégration persistante Supabase</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-med)',
              transition: 'var(--transition-fast)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Connection status card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '16px',
            borderRadius: 'var(--border-radius-md)',
            backgroundColor: isSupabaseConnected ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)',
            border: `1px solid ${isSupabaseConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
            marginBottom: '24px'
          }}
        >
          {isSupabaseConnected ? (
            <>
              <CheckCircle size={22} style={{ color: 'var(--accent-success)' }} />
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-success)' }}>Connecté à Supabase</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-med)', marginTop: '2px' }}>Vos données sont synchronisées sur le Cloud.</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={22} style={{ color: 'var(--accent-warning)' }} />
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-warning)' }}>Mode Démo (LocalStorage)</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-med)', marginTop: '2px' }}>Les données sont sauvées dans votre navigateur local. Connectez Supabase pour persister d'ici.</p>
              </div>
            </>
          )}
        </div>

        {/* User Account / Login State for Mobile & general access */}
        {isSupabaseConnected && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              padding: '16px',
              borderRadius: 'var(--border-radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              marginBottom: '24px'
            }}
          >
            {user ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    textTransform: 'capitalize'
                  }}>
                    {user.email ? user.email.split('@')[0][0] : 'U'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      {user.email ? user.email.split('@')[0] : 'Utilisateur'}
                    </h4>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-low)' }}>Compte Cloud Actif</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {syncFeedback && (
                    <span style={{ fontSize: '0.72rem', color: syncFeedback.includes('réussie') ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {syncFeedback}
                    </span>
                  )}
                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    title="Forcer la synchronisation avec le cloud"
                    style={{
                      backgroundColor: 'rgba(168, 85, 247, 0.08)',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                      color: 'var(--accent-primary)',
                      borderRadius: 'var(--border-radius-sm)',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: isSyncing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'var(--transition-fast)',
                      opacity: isSyncing ? 0.7 : 1
                    }}
                    onMouseOver={(e) => { if (!isSyncing) e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.15)'; }}
                    onMouseOut={(e) => { if (!isSyncing) e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.08)'; }}
                  >
                    <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                    {isSyncing ? 'Synchro...' : 'Synchroniser'}
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      onClose();
                    }}
                    style={{
                      backgroundColor: 'rgba(244, 63, 94, 0.08)',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      color: '#fb7185',
                      borderRadius: 'var(--border-radius-sm)',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'var(--transition-fast)'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.15)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.08)'; }}
                  >
                    <LogOut size={12} />
                    Déconnexion
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-med)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <User size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-med)', margin: 0 }}>Non connecté</h4>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-low)' }}>Vos données ne sont pas synchronisées.</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    if (openLogin) openLogin();
                  }}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '8px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)',
                    boxShadow: 'var(--shadow-neon-primary)'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.filter = 'none'; }}
                >
                  Se connecter
                </button>
              </>
            )}
          </div>
        )}

        {/* Input credentials Form */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '30px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-med)', marginBottom: '6px' }}>
              Supabase Project URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project-id.supabase.co"
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)',
                padding: '12px 16px',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'var(--transition-fast)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-med)', marginBottom: '6px' }}>
              Supabase Anon Public API Key
            </label>
            <input
              type="password"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)',
                padding: '12px 16px',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'var(--transition-fast)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* AI Settings Section */}
          <div style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            paddingTop: '20px',
            marginTop: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>Configuration IA (Optionnel)</h4>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-med)', marginBottom: '6px' }}>
                Endpoint API IA (compatible OpenAI)
              </label>
              <input
                type="text"
                value={aiUrl}
                onChange={(e) => setAiUrl(e.target.value)}
                placeholder="https://api.deepseek.com/v1"
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  outline: 'none',
                  color: '#ffffff'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-med)', marginBottom: '6px' }}>
                Clé API IA (DeepSeek / OpenAI API Key)
              </label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="sk-..."
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  outline: 'none',
                  color: '#ffffff'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-med)', marginBottom: '6px' }}>
                Modèle d'Évaluation
              </label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="deepseek-chat"
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  outline: 'none',
                  color: '#ffffff'
                }}
              />
            </div>
          </div>

          {statusMessage && (
            <div style={{
              fontSize: '0.85rem',
              color: statusMessage.error ? 'var(--accent-danger)' : 'var(--accent-success)',
              padding: '10px 4px'
            }}>
              {statusMessage.text}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="submit"
              style={{
                flex: 2,
                backgroundColor: 'var(--accent-primary)',
                border: 'none',
                borderRadius: 'var(--border-radius-md)',
                padding: '12px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                boxShadow: 'var(--shadow-neon-primary)'
              }}
              onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
              onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
            >
              Enregistrer & Connecter
            </button>

            {isSupabaseConnected && (
              <button
                type="button"
                onClick={handleDisconnect}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: '1px solid var(--accent-danger)',
                  color: 'var(--accent-danger)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.08)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Déconnecter
              </button>
            )}
          </div>
        </form>

        {/* Database setup SQL info */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Configuration SQL Supabase</h3>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={copySQL}
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  color: 'var(--accent-primary)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  padding: '6px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Table Initialisation Copiée !' : 'Copier SQL Initialisation'}
              </button>

              <button
                onClick={copyMigrationSQL}
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  color: 'var(--accent-secondary)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  padding: '6px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                {copiedMigration ? <Check size={14} /> : <Copy size={14} />}
                {copiedMigration ? 'Migration Points Copiée !' : 'Copier SQL Migration'}
              </button>
            </div>
          </div>
          <p style={{ color: 'var(--text-med)', fontSize: '0.8rem', marginBottom: '12px', lineHeight: 1.4 }}>
            Allez dans le <strong>SQL Editor</strong> de votre console Supabase, collez le script ci-dessous, puis cliquez sur <strong>Run</strong> pour configurer la base de données.
          </p>
          <pre style={{
            fontSize: '0.75rem',
            backgroundColor: '#020306',
            padding: '16px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--border-color)',
            maxHeight: '180px',
            overflowY: 'auto',
            color: '#a5b4fc',
            fontFamily: 'monospace',
            textAlign: 'left'
          }}>
            {`-- Table des Objectifs Finaux
CREATE TABLE final_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    difficulty INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    target_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Table des Jalons
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    final_goal_id UUID REFERENCES final_goals(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    difficulty INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    order_index INTEGER DEFAULT 0,
    target_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Table des Sous-tâches
CREATE TABLE subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Table des Habitudes (Routines)
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL,
    frequency_type TEXT NOT NULL CHECK (frequency_type IN ('daily', 'weekly', 'custom')),
    custom_days_per_week INTEGER,
    goal_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Table des logs de validation d'habitudes
CREATE TABLE IF NOT EXISTS habit_logs (
    habit_id UUID REFERENCES habits(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('done', 'missed')),
    PRIMARY KEY (habit_id, date)
);

-- Table des Indicateurs de Suivi (Trackers)
CREATE TABLE IF NOT EXISTS trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    periodicity TEXT NOT NULL,
    unit TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tracker_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracker_id UUID REFERENCES trackers(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tables de Musculation Strong
CREATE TABLE IF NOT EXISTS strong_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strong_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strong_workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID REFERENCES strong_workouts(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    set_order INTEGER NOT NULL,
    weight NUMERIC NOT NULL,
    reps INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Politiques de sécurité RLS
DROP POLICY IF EXISTS "Users can manage their own strong exercises" ON strong_exercises;
CREATE POLICY "Users can manage their own strong exercises" ON strong_exercises FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own strong workouts" ON strong_workouts;
CREATE POLICY "Users can manage their own strong workouts" ON strong_workouts FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own strong workout sets" ON strong_workout_sets;
CREATE POLICY "Users can manage their own strong workout sets" ON strong_workout_sets FOR ALL USING (
    EXISTS (SELECT 1 FROM strong_workouts WHERE id = strong_workout_sets.workout_id AND (user_id = auth.uid() OR user_id IS NULL))
    OR NOT EXISTS (SELECT 1 FROM strong_workouts WHERE id = strong_workout_sets.workout_id)
) WITH CHECK (true);

UPDATE strong_workouts SET user_id = auth.uid() WHERE user_id IS NULL;
UPDATE strong_exercises SET user_id = auth.uid() WHERE user_id IS NULL;

-- Activation de la synchronisation en temps réel (Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE final_goals, milestones, subtasks, habits, habit_logs, trackers, tracker_logs, strong_exercises, strong_workouts, strong_workout_sets;`}
          </pre>
        </div>

        {/* Data Utilities Panel */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (window.confirm('Voulez-vous charger les données de démonstration ? Cela va ajouter de nouveaux objectifs et jalons à votre base active.')) {
                loadDemoData();
                onClose();
              }
            }}
            style={{
              flex: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color-hover)',
              padding: '10px',
              fontSize: '0.8rem',
              fontWeight: 500,
              borderRadius: 'var(--border-radius-sm)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
          >
            🔌 Importer Données Démo
          </button>

          <button
            onClick={() => {
              if (window.confirm('🚨 ATTENTION : Cette action supprimera DEFINITIVEMENT tous les objectifs, jalons et sous-tâches de la base actuellement active. Continuer ?')) {
                clearDatabase();
                onClose();
              }
            }}
            style={{
              flex: 1,
              backgroundColor: 'rgba(244, 63, 94, 0.05)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              color: 'var(--accent-danger)',
              padding: '10px',
              fontSize: '0.8rem',
              fontWeight: 500,
              borderRadius: 'var(--border-radius-sm)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.05)'}
          >
            🔥 Tout Effacer (Reset)
          </button>
        </div>
      </div>
    </div>
  );
};
