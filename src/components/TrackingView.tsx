import React, { useState, useMemo } from 'react';
import { useGoals } from '../context/GoalContext';
import { 
  Plus, 
  Trash2, 
  Database,
  Info,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  LineChart,
  Edit3,
  BarChart3
} from 'lucide-react';

export const TrackingView: React.FC = () => {
  const { 
    trackers, 
    trackerLogs, 
    addTracker, 
    deleteTracker, 
    addTrackerLog, 
    deleteTrackerLog,
    isSupabaseConnected
  } = useGoals();

  // Top Sub-Tab: 'entry' (Saisie & Cartes) | 'stats' (Statistiques & Graphiques)
  const [activeSubTab, setActiveSubTab] = useState<'entry' | 'stats'>('entry');

  // Creation panel toggle
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [periodicity, setPeriodicity] = useState<'daily' | 'hebdo' | 'month' | 'custom'>('daily');
  const [unit, setUnit] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Quick-add values per tracker: Record<trackerId, string>
  const [quickAddValues, setQuickAddValues] = useState<Record<string, string>>({});
  const [quickAddFeedback, setQuickAddFeedback] = useState<Record<string, string>>({});

  // Expanded logs history per tracker: Record<trackerId, boolean>
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  // Stats tab states
  const [statsTrackerId, setStatsTrackerId] = useState<string | null>(trackers[0]?.id || null);
  const [timeFilter, setTimeFilter] = useState<'7d' | '1m' | '3m' | '1y' | 'all'>('1m');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; date: string; value: number } | null>(null);

  // Collapsible SQL Guide State
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // Selected tracker for stats fallback
  const activeStatsTracker = trackers.find(t => t.id === (statsTrackerId || trackers[0]?.id)) || trackers[0];

  // Helper: Format relative date
  const getRelativeDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];

    if (dateStr === today) return "Aujourd'hui";
    if (dateStr === yesterday) return "Hier";

    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  // Helper: Quick Add Log
  const handleQuickAdd = async (trackerId: string) => {
    const val = (quickAddValues[trackerId] || '').trim();
    if (!val) return;

    const todayStr = new Date().toISOString().split('T')[0];
    try {
      await addTrackerLog(trackerId, todayStr, val);
      setQuickAddValues(prev => ({ ...prev, [trackerId]: '' }));
      setQuickAddFeedback(prev => ({ ...prev, [trackerId]: 'Enregistré !' }));
      setTimeout(() => {
        setQuickAddFeedback(prev => ({ ...prev, [trackerId]: '' }));
      }, 2500);
    } catch {
      setQuickAddFeedback(prev => ({ ...prev, [trackerId]: 'Erreur' }));
    }
  };

  // Helper: Create Tracker
  const handleCreateTracker = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) {
      setErrorMsg('Veuillez donner un nom à votre indicateur.');
      return;
    }
    if (!unit.trim()) {
      setErrorMsg("Veuillez renseigner une unité (ex: 'kg', 'h', '/10').");
      return;
    }

    try {
      const newId = await addTracker(name.trim(), periodicity, unit.trim());
      setSuccessMsg('Indicateur créé avec succès !');
      if (!statsTrackerId) setStatsTrackerId(newId);
      setName('');
      setUnit('');
      setShowCreateModal(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la création.');
    }
  };

  // Stats calculation for the selected tracker
  const statsData = useMemo(() => {
    if (!activeStatsTracker) return null;

    // Filter logs for this tracker
    const allLogs = trackerLogs
      .filter(l => l.tracker_id === activeStatsTracker.id)
      .map(l => ({
        date: l.date,
        value: parseFloat(l.value.replace(',', '.')),
        raw: l.value
      }))
      .filter(l => !isNaN(l.value))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (allLogs.length === 0) return null;

    // Apply time filter
    const now = new Date();
    let cutoff = new Date();
    if (timeFilter === '7d') cutoff.setDate(now.getDate() - 7);
    else if (timeFilter === '1m') cutoff.setDate(now.getDate() - 30);
    else if (timeFilter === '3m') cutoff.setDate(now.getDate() - 90);
    else if (timeFilter === '1y') cutoff.setFullYear(now.getFullYear() - 1);
    else cutoff = new Date(0); // All

    const cutoffStr = cutoff.toISOString().split('T')[0];
    const filteredLogs = timeFilter === 'all' ? allLogs : allLogs.filter(l => l.date >= cutoffStr);
    const logsToUse = filteredLogs.length > 0 ? filteredLogs : allLogs;

    const values = logsToUse.map(l => l.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const avg = Math.round((sum / values.length) * 100) / 100;

    const firstVal = values[0];
    const lastVal = values[values.length - 1];
    const diff = Math.round((lastVal - firstVal) * 100) / 100;
    const pctChange = firstVal !== 0 ? Math.round(((lastVal - firstVal) / firstVal) * 1000) / 10 : 0;

    // 7-day rolling average for the latest values
    const last7Logs = logsToUse.slice(-7);
    const avg7d = Math.round((last7Logs.reduce((acc, c) => acc + c.value, 0) / last7Logs.length) * 100) / 100;

    return {
      logs: logsToUse,
      min,
      max,
      avg,
      avg7d,
      lastVal,
      diff,
      pctChange,
      count: logsToUse.length
    };
  }, [activeStatsTracker, trackerLogs, timeFilter]);

  // SVG Chart Dimensions & Coordinates
  const chartPoints = useMemo(() => {
    if (!statsData || statsData.logs.length === 0) return null;

    const svgWidth = 700;
    const svgHeight = 260;
    const padX = 50;
    const padY = 35;
    const plotW = svgWidth - padX * 2;
    const plotH = svgHeight - padY * 2;

    const logs = statsData.logs;
    const minVal = statsData.min;
    const maxVal = statsData.max;
    const valSpan = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    const points = logs.map((l, idx) => {
      const x = padX + (idx / Math.max(1, logs.length - 1)) * plotW;
      const y = padY + plotH - ((l.value - minVal) / valSpan) * plotH;
      return { x, y, date: l.date, value: l.value };
    });

    const pathD = points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    const areaD = points.length > 0 
      ? `${pathD} L ${points[points.length - 1].x} ${padY + plotH} L ${points[0].x} ${padY + plotH} Z`
      : '';

    return { points, pathD, areaD, svgWidth, svgHeight, padX, padY, plotW, plotH, minVal, maxVal };
  }, [statsData]);

  const sqlQueryText = `-- SQL de migration pour le Tracking de Données.
-- À exécuter dans votre console Supabase > SQL Editor si nécessaire.

CREATE TABLE IF NOT EXISTS public.trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  periodicity TEXT NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.tracker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id UUID REFERENCES public.trackers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracker_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own trackers" ON public.trackers;
CREATE POLICY "Users can manage their own trackers" ON public.trackers FOR ALL 
USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own tracker logs" ON public.tracker_logs;
CREATE POLICY "Users can manage their own tracker logs" ON public.tracker_logs FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.trackers WHERE id = tracker_logs.tracker_id AND (user_id = auth.uid() OR user_id IS NULL))
  OR NOT EXISTS (SELECT 1 FROM public.trackers WHERE id = tracker_logs.tracker_id)
) WITH CHECK (true);

UPDATE public.trackers SET user_id = auth.uid() WHERE user_id IS NULL;`;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Responsive Styles */}
      <style>{`
        .tracker-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }
        @media (max-width: 640px) {
          .tracker-cards-grid {
            grid-template-columns: 1fr !important;
          }
          .stats-kpis-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LineChart style={{ color: 'var(--accent-secondary)' }} />
            Suivi & Mesures (Tracking)
          </h1>
          <p style={{ color: 'var(--text-med)', fontSize: '0.95rem' }}>
            Saisie ultra-rapide de vos indicateurs de vie et graphiques de progression interactifs.
          </p>
        </div>

        {/* New Tracker Button */}
        <button
          onClick={() => setShowCreateModal(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            color: 'var(--accent-secondary)',
            padding: '10px 18px',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'var(--transition-fast)'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.18)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.1)'}
        >
          <Plus size={16} />
          <span>{showCreateModal ? 'Fermer le formulaire' : 'Nouvel Indicateur'}</span>
        </button>
      </div>

      {/* Collapsible New Tracker Creation Form */}
      {showCreateModal && (
        <form 
          onSubmit={handleCreateTracker}
          className="glass animate-fade-in"
          style={{
            borderRadius: 'var(--border-radius-lg)',
            padding: '24px',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Créer un nouvel indicateur
          </h3>

          {errorMsg && (
            <div style={{ color: 'var(--accent-danger)', fontSize: '0.82rem', padding: '8px 12px', backgroundColor: 'rgba(244, 63, 94, 0.08)', borderRadius: '6px' }}>
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ color: 'var(--accent-success)', fontSize: '0.82rem', padding: '8px 12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px' }}>
              {successMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-med)', display: 'block', marginBottom: '6px' }}>
                Nom de l'indicateur *
              </label>
              <input
                type="text"
                placeholder="Ex: Poids, Sommeil, Pages lues..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  color: '#ffffff',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-med)', display: 'block', marginBottom: '6px' }}>
                Unité de mesure *
              </label>
              <input
                type="text"
                placeholder="Ex: kg, heures, /10, pages..."
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  color: '#ffffff',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-med)', display: 'block', marginBottom: '6px' }}>
                Fréquence attendue
              </label>
              <select
                value={periodicity}
                onChange={(e: any) => setPeriodicity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#0a0d18',
                  color: '#ffffff',
                  fontSize: '0.9rem'
                }}
              >
                <option value="daily">🔄 Quotidien</option>
                <option value="hebdo">📅 Hebdomadaire</option>
                <option value="month">🗓️ Mensuel</option>
                <option value="custom">⏱️ Personnalisé</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                padding: '8px 16px',
                borderRadius: 'var(--border-radius-sm)',
                color: 'var(--text-med)',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Annuler
            </button>

            <button
              type="submit"
              style={{
                backgroundColor: 'var(--accent-secondary)',
                border: 'none',
                padding: '8px 20px',
                borderRadius: 'var(--border-radius-sm)',
                color: '#000000',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
                boxShadow: 'var(--shadow-neon-secondary)'
              }}
            >
              Enregistrer l'indicateur
            </button>
          </div>
        </form>
      )}

      {/* Top Segmented Control (Saisie vs Statistiques) */}
      <div 
        className="glass"
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          borderRadius: '50px',
          padding: '4px',
          gap: '4px',
          border: '1px solid var(--border-color)',
          maxWidth: '100%',
          overflowX: 'auto'
        }}
      >
        <button
          onClick={() => setActiveSubTab('entry')}
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
            backgroundColor: activeSubTab === 'entry' ? 'var(--accent-secondary)' : 'transparent',
            color: activeSubTab === 'entry' ? '#000000' : 'var(--text-med)',
            boxShadow: activeSubTab === 'entry' ? 'var(--shadow-neon-secondary)' : 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <Edit3 size={16} />
          <span>Saisie & Données</span>
        </button>

        <button
          onClick={() => setActiveSubTab('stats')}
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
            backgroundColor: activeSubTab === 'stats' ? 'var(--accent-secondary)' : 'transparent',
            color: activeSubTab === 'stats' ? '#000000' : 'var(--text-med)',
            boxShadow: activeSubTab === 'stats' ? 'var(--shadow-neon-secondary)' : 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <BarChart3 size={16} />
          <span>Statistiques & Graphiques</span>
        </button>
      </div>

      {/* VOLET 1 : SAISIE & CARTES AVEC QUICK-ADD */}
      {activeSubTab === 'entry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {trackers.length === 0 ? (
            <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '48px 24px', textAlign: 'center', color: 'var(--text-low)' }}>
              <LineChart size={48} style={{ color: 'var(--accent-secondary)', marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                Aucun indicateur configuré
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-med)', maxWidth: '420px', margin: '0 auto 20px auto' }}>
                Créez votre premier indicateur (ex: Poids corporel, Heures de sommeil, Pages lues) pour commencer à consigner vos valeurs.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  backgroundColor: 'var(--accent-secondary)',
                  color: '#000000',
                  border: 'none',
                  borderRadius: 'var(--border-radius-sm)',
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-neon-secondary)'
                }}
              >
                ➕ Créer mon premier indicateur
              </button>
            </div>
          ) : (
            <div className="tracker-cards-grid">
              {trackers.map(tracker => {
                // Logs for this tracker sorted descending
                const logs = trackerLogs
                  .filter(l => l.tracker_id === tracker.id)
                  .sort((a, b) => b.date.localeCompare(a.date));

                const latestLog = logs[0];
                const prevLog = logs[1];

                // Calculate delta if numeric
                let delta: number | null = null;
                if (latestLog && prevLog) {
                  const numLatest = parseFloat(latestLog.value.replace(',', '.'));
                  const numPrev = parseFloat(prevLog.value.replace(',', '.'));
                  if (!isNaN(numLatest) && !isNaN(numPrev)) {
                    delta = Math.round((numLatest - numPrev) * 100) / 100;
                  }
                }

                const isLogsExpanded = !!expandedLogs[tracker.id];
                const feedback = quickAddFeedback[tracker.id];

                return (
                  <div
                    key={tracker.id}
                    className="glass"
                    style={{
                      borderRadius: 'var(--border-radius-lg)',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      border: '1px solid var(--border-color)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                          {tracker.name}
                        </h3>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-med)',
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}>
                            {tracker.periodicity === 'daily' ? '🔄 Quotidien' 
                             : tracker.periodicity === 'hebdo' ? '📅 Hebdo'
                             : tracker.periodicity === 'month' ? '🗓️ Mensuel'
                             : '⏱️ Custom'}
                          </span>

                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            backgroundColor: 'rgba(6, 182, 212, 0.08)',
                            border: '1px solid rgba(6, 182, 212, 0.2)',
                            color: 'var(--accent-secondary)',
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}>
                            {tracker.unit}
                          </span>
                        </div>
                      </div>

                      {/* Delete Tracker */}
                      <button
                        onClick={() => {
                          if (window.confirm(`Supprimer l'indicateur "${tracker.name}" et toutes ses données associées ?`)) {
                            deleteTracker(tracker.id);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-low)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-danger)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-low)'}
                        title="Supprimer l'indicateur"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Prominent Latest Value Display */}
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: 'var(--border-radius-md)',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-med)', display: 'block', marginBottom: '2px' }}>
                          Dernière mesure :
                        </span>
                        {latestLog ? (
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                              {latestLog.value}
                            </span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                              {tracker.unit}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-low)', fontStyle: 'italic' }}>
                            Aucune mesure
                          </span>
                        )}
                      </div>

                      {latestLog && (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: 'var(--text-high)',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            display: 'inline-block'
                          }}>
                            {getRelativeDateLabel(latestLog.date)}
                          </span>

                          {delta !== null && (
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'flex-end', 
                              gap: '3px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              marginTop: '4px',
                              color: delta > 0 ? '#38bdf8' : delta < 0 ? '#f43f5e' : 'var(--text-med)'
                            }}>
                              {delta > 0 ? <TrendingUp size={13} /> : delta < 0 ? <TrendingDown size={13} /> : null}
                              <span>{delta > 0 ? `+${delta}` : delta}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick-Add Input Row */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-med)' }}>
                        ⚡ Ajouter la valeur du jour :
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={`Ex: 75.2 ${tracker.unit}`}
                          value={quickAddValues[tracker.id] || ''}
                          onChange={(e) => setQuickAddValues(prev => ({ ...prev, [tracker.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleQuickAdd(tracker.id);
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '9px 12px',
                            borderRadius: 'var(--border-radius-sm)',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                            color: '#ffffff',
                            fontSize: '0.9rem'
                          }}
                        />

                        <button
                          onClick={() => handleQuickAdd(tracker.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            backgroundColor: 'var(--accent-secondary)',
                            color: '#000000',
                            border: 'none',
                            padding: '0 16px',
                            borderRadius: 'var(--border-radius-sm)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-neon-secondary)',
                            transition: 'var(--transition-fast)'
                          }}
                        >
                          <Plus size={16} strokeWidth={3} />
                          <span>Ajouter</span>
                        </button>
                      </div>

                      {feedback && (
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          color: feedback.includes('Erreur') ? 'var(--accent-danger)' : 'var(--accent-success)',
                          marginTop: '2px'
                        }}>
                          {feedback}
                        </span>
                      )}
                    </div>

                    {/* Expand/Collapse History Link */}
                    {logs.length > 0 && (
                      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                        <button
                          onClick={() => setExpandedLogs(prev => ({ ...prev, [tracker.id]: !prev[tracker.id] }))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-secondary)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: 0
                          }}
                        >
                          <ChevronRight size={14} style={{ transform: isLogsExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                          <span>{isLogsExpanded ? 'Masquer l\'historique' : `Voir l'historique (${logs.length} saisie${logs.length > 1 ? 's' : ''})`}</span>
                        </button>

                        {/* Collapsible History Table */}
                        {isLogsExpanded && (
                          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                            {logs.map(log => (
                              <div
                                key={log.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '6px 10px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                  fontSize: '0.8rem'
                                }}
                              >
                                <span style={{ color: 'var(--text-med)' }}>{log.date}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontWeight: 700, color: '#ffffff' }}>
                                    {log.value} {tracker.unit}
                                  </span>
                                  <button
                                    onClick={() => deleteTrackerLog(log.id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-low)',
                                      cursor: 'pointer',
                                      padding: '2px'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-danger)'}
                                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-low)'}
                                    title="Supprimer cette mesure"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VOLET 2 : STATISTIQUES & GRAPHIQUES INTERACTIFS */}
      {activeSubTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Controls row: Tracker Picker & Time Filter Pills */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            
            {/* Tracker Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-med)' }}>
                Indicateur :
              </label>
              <select
                value={activeStatsTracker?.id || ''}
                onChange={(e) => setStatsTrackerId(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--border-radius-sm)',
                  backgroundColor: '#0a0d18',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                {trackers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Time Filter Pills */}
            <div 
              className="glass"
              style={{
                display: 'flex',
                borderRadius: '50px',
                padding: '3px',
                gap: '2px',
                border: '1px solid var(--border-color)'
              }}
            >
              {(['7d', '1m', '3m', '1y', 'all'] as const).map(tf => {
                const label = tf === '7d' ? '7j' : tf === '1m' ? '1M' : tf === '3m' ? '3M' : tf === '1y' ? '1An' : 'Tout';
                const isSel = timeFilter === tf;
                return (
                  <button
                    key={tf}
                    onClick={() => setTimeFilter(tf)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '50px',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: isSel ? 700 : 500,
                      cursor: 'pointer',
                      backgroundColor: isSel ? 'var(--accent-secondary)' : 'transparent',
                      color: isSel ? '#000000' : 'var(--text-med)',
                      transition: 'var(--transition-fast)'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats Summary KPIs */}
          {statsData ? (
            <>
              <div 
                className="stats-kpis-grid" 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                  gap: '12px' 
                }}
              >
                {/* Latest */}
                <div className="glass" style={{ borderRadius: 'var(--border-radius-md)', padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-med)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Dernière valeur
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                    {statsData.lastVal} <span style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>{activeStatsTracker?.unit}</span>
                  </div>
                </div>

                {/* 7-Day Average */}
                <div className="glass" style={{ borderRadius: 'var(--border-radius-md)', padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-med)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Moyenne (7 j)
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                    {statsData.avg7d} <span style={{ fontSize: '0.85rem', color: 'var(--text-med)' }}>{activeStatsTracker?.unit}</span>
                  </div>
                </div>

                {/* Min / Max */}
                <div className="glass" style={{ borderRadius: 'var(--border-radius-md)', padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-med)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Min • Max
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                    {statsData.min} • {statsData.max}
                  </div>
                </div>

                {/* Net Evolution */}
                <div className="glass" style={{ borderRadius: 'var(--border-radius-md)', padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-med)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Évolution nette
                  </span>
                  <div style={{ 
                    fontSize: '1.4rem', 
                    fontWeight: 800, 
                    color: statsData.diff > 0 ? '#38bdf8' : statsData.diff < 0 ? '#f43f5e' : 'var(--text-med)', 
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {statsData.diff > 0 ? `+${statsData.diff}` : statsData.diff}
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>({statsData.pctChange > 0 ? `+${statsData.pctChange}%` : `${statsData.pctChange}%`})</span>
                  </div>
                </div>
              </div>

              {/* Interactive Vector SVG Chart */}
              {chartPoints && (
                <div 
                  className="glass" 
                  style={{ 
                    borderRadius: 'var(--border-radius-lg)', 
                    padding: '24px', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      Courbe d'évolution temporelle
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-low)' }}>
                      {chartPoints.points.length} point{chartPoints.points.length > 1 ? 's' : ''} de mesure
                    </span>
                  </div>

                  <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
                    <svg
                      viewBox={`0 0 ${chartPoints.svgWidth} ${chartPoints.svgHeight}`}
                      style={{ width: '100%', height: 'auto', minWidth: '420px', display: 'block' }}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <defs>
                        <linearGradient id="trackGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent-secondary)" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid Guides */}
                      <line
                        x1={chartPoints.padX}
                        y1={chartPoints.padY}
                        x2={chartPoints.svgWidth - chartPoints.padX}
                        y2={chartPoints.padY}
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={chartPoints.padX - 8}
                        y={chartPoints.padY + 4}
                        fill="var(--text-low)"
                        fontSize="10"
                        textAnchor="end"
                      >
                        {statsData.max}
                      </text>

                      <line
                        x1={chartPoints.padX}
                        y1={chartPoints.padY + chartPoints.plotH}
                        x2={chartPoints.svgWidth - chartPoints.padX}
                        y2={chartPoints.padY + chartPoints.plotH}
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={chartPoints.padX - 8}
                        y={chartPoints.padY + chartPoints.plotH + 4}
                        fill="var(--text-low)"
                        fontSize="10"
                        textAnchor="end"
                      >
                        {statsData.min}
                      </text>

                      {/* Area Fill */}
                      <path d={chartPoints.areaD} fill="url(#trackGrad)" />

                      {/* Stroke Line */}
                      <path
                        d={chartPoints.pathD}
                        fill="none"
                        stroke="var(--accent-secondary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Interactive Circles / Points */}
                      {chartPoints.points.map((pt, i) => (
                        <circle
                          key={i}
                          cx={pt.x}
                          cy={pt.y}
                          r={hoveredPoint?.date === pt.date ? 6 : 3.5}
                          fill={hoveredPoint?.date === pt.date ? '#ffffff' : 'var(--accent-secondary)'}
                          stroke="#0a0d18"
                          strokeWidth="2"
                          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                          onMouseEnter={() => setHoveredPoint(pt)}
                          onTouchStart={() => setHoveredPoint(pt)}
                        />
                      ))}
                    </svg>

                    {/* Tooltip Overlay */}
                    {hoveredPoint && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '12px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: 'rgba(10, 13, 24, 0.95)',
                          border: '1px solid var(--accent-secondary)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: '#ffffff',
                          pointerEvents: 'none',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span style={{ color: 'var(--text-med)' }}>{hoveredPoint.date} :</span>
                        <span style={{ color: 'var(--accent-secondary)' }}>
                          {hoveredPoint.value} {activeStatsTracker?.unit}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '40px', textAlign: 'center', color: 'var(--text-low)' }}>
              <Info size={36} style={{ color: 'var(--text-low)', marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: '#ffffff' }}>
                Pas assez de données pour générer un graphique
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-med)', marginTop: '4px' }}>
                Saisissez au moins 1 ou 2 valeurs dans l'onglet « Saisie & Données » pour visualiser votre tendance.
              </p>
            </div>
          )}

          {/* Database Guide Collapsible */}
          {isSupabaseConnected && (
            <div className="glass" style={{ borderRadius: 'var(--border-radius-md)', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setShowSqlGuide(prev => !prev)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={15} style={{ color: 'var(--accent-secondary)' }} />
                  Synchronisation Supabase Cloud & RLS
                </span>
                <ChevronRight size={16} style={{ transform: showSqlGuide ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-low)' }} />
              </button>

              {showSqlGuide && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-med)', margin: 0 }}>
                    Script SQL pour initialiser ou vérifier les tables et la sécurité RLS sur votre projet Supabase :
                  </p>
                  <pre style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '10px',
                    fontSize: '0.65rem',
                    color: '#a7f3d0',
                    overflowX: 'auto',
                    maxHeight: '180px',
                    fontFamily: 'monospace',
                    margin: 0
                  }}>
                    {sqlQueryText}
                  </pre>
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
