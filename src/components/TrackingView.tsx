import React, { useState } from 'react';
import { useGoals } from '../context/GoalContext';
import { 
  TrendingUp, 
  Plus, 
  Trash2, 
  Calendar, 
  Activity, 
  Database,
  Info,
  ChevronRight,
  TrendingDown,
  LineChart
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

  // Selected Tracker State
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(
    trackers.length > 0 ? trackers[0].id : null
  );

  // Form State for creating a Tracker
  const [name, setName] = useState('');
  const [periodicity, setPeriodicity] = useState<'daily' | 'hebdo' | 'month' | 'custom'>('daily');
  const [unit, setUnit] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State for logging a value
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logValue, setLogValue] = useState('');
  const [logErrorMsg, setLogErrorMsg] = useState('');

  // Collapsible SQL Guide State
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // If no tracker is selected but trackers exist, select the first one
  const activeTracker = trackers.find(t => t.id === (selectedTrackerId || (trackers[0]?.id)));
  
  // Update state helper if selected tracker no longer exists
  if (selectedTrackerId && !trackers.some(t => t.id === selectedTrackerId)) {
    setSelectedTrackerId(trackers[0]?.id || null);
  }

  // Get logs for the active tracker, sorted by date descending
  const activeLogs = activeTracker 
    ? trackerLogs
        .filter(l => l.tracker_id === activeTracker.id)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  // Statistics calculation if numeric
  const getNumericStats = () => {
    if (activeLogs.length === 0) return null;
    
    const numericValues = activeLogs
      .map(l => parseFloat(l.value.replace(',', '.')))
      .filter(val => !isNaN(val));

    if (numericValues.length === 0) return null;

    const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
    const avg = Math.round((sum / numericValues.length) * 100) / 100;
    const max = Math.max(...numericValues);
    const min = Math.min(...numericValues);
    const latest = numericValues[0];
    
    let trend: 'up' | 'down' | 'stable' | null = null;
    if (numericValues.length > 1) {
      const prev = numericValues[1];
      if (latest > prev) trend = 'up';
      else if (latest < prev) trend = 'down';
      else trend = 'stable';
    }

    return { avg, max, min, latest, trend };
  };

  const stats = getNumericStats();

  const handleCreateTracker = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) {
      setErrorMsg('Veuillez donner un nom à votre indicateur.');
      return;
    }
    if (!unit.trim()) {
      setErrorMsg("Veuillez renseigner une unité (ex: 'kg', 'heures', 'sur 10').");
      return;
    }

    try {
      const newId = await addTracker(name.trim(), periodicity, unit.trim());
      setSuccessMsg('Indicateur créé avec succès !');
      setSelectedTrackerId(newId);
      setName('');
      setUnit('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la création.');
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogErrorMsg('');

    if (!activeTracker) return;
    if (!logValue.trim()) {
      setLogErrorMsg('Veuillez saisir une valeur.');
      return;
    }
    if (!logDate) {
      setLogErrorMsg('Veuillez choisir une date valide.');
      return;
    }

    try {
      await addTrackerLog(activeTracker.id, logDate, logValue.trim());
      setLogValue('');
    } catch (err: any) {
      setLogErrorMsg(err.message || "Erreur lors de l'enregistrement de la valeur.");
    }
  };

  const sqlQueryText = `-- SQL de migration pour le Tracking de Données.
-- À exécuter dans l'éditeur SQL de votre console Supabase.

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

-- Activation de la Row Level Security (RLS)
ALTER TABLE trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracker_logs ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité pour les indicateurs (trackers)
CREATE POLICY "Allow individual read trackers" ON trackers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow individual insert trackers" ON trackers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow individual update trackers" ON trackers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow individual delete trackers" ON trackers FOR DELETE USING (auth.uid() = user_id);

-- Politiques de sécurité pour les journaux (tracker_logs)
CREATE POLICY "Allow read logs" ON tracker_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM trackers WHERE trackers.id = tracker_logs.tracker_id AND trackers.user_id = auth.uid())
);
CREATE POLICY "Allow insert logs" ON tracker_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM trackers WHERE trackers.id = tracker_logs.tracker_id AND trackers.user_id = auth.uid())
);
CREATE POLICY "Allow update logs" ON tracker_logs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM trackers WHERE trackers.id = tracker_logs.tracker_id AND trackers.user_id = auth.uid())
);
CREATE POLICY "Allow delete logs" ON tracker_logs FOR DELETE USING (
  EXISTS (SELECT 1 FROM trackers WHERE trackers.id = tracker_logs.tracker_id AND trackers.user_id = auth.uid())
);`;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 1024px) {
          .tracking-grid-layout {
            flex-direction: column !important;
          }
          .tracking-left-panel, .tracking-right-panel {
            flex: 1 1 100% !important;
            width: 100% !important;
          }
        }
        @media (max-width: 640px) {
          .tracker-item-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
        }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LineChart style={{ color: 'var(--accent-primary)' }} />
          Suivi des Indicateurs (Tracking)
        </h1>
        <p style={{ color: 'var(--text-med)', fontSize: '0.95rem' }}>
          Suivez vos statistiques clés au quotidien, hebdomadairement ou mensuellement (Poids, Sommeil, Productivité, etc.).
        </p>
      </div>

      {/* Grid Layout */}
      <div className="tracking-grid-layout" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* LEFT PANEL: Trackers List & Detail Logs (Flex 60%) */}
        <div className="tracking-left-panel" style={{ flex: '1 1 58%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* List Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0', color: '#ffffff' }}>
              Mes Indicateurs Actifs ({trackers.length})
            </h2>

            {trackers.length === 0 ? (
              <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '40px', textAlign: 'center', color: 'var(--text-low)' }}>
                <Activity size={40} style={{ color: 'var(--text-low)', marginBottom: '12px', opacity: 0.5 }} />
                <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Aucun indicateur de suivi configuré.</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-low)', marginTop: '4px' }}>
                  Utilisez le formulaire à droite pour créer votre premier indicateur (ex: Poids, Pages lues...).
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                {trackers.map(t => {
                  const isActive = activeTracker?.id === t.id;
                  const logCount = trackerLogs.filter(l => l.tracker_id === t.id).length;
                  
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTrackerId(t.id)}
                      className="glass-interactive"
                      style={{
                        borderRadius: 'var(--border-radius-md)',
                        padding: '16px',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-color)',
                        backgroundColor: isActive ? 'rgba(168, 85, 247, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', wordBreak: 'break-word' }}>
                          {t.name}
                        </span>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Voulez-vous supprimer l'indicateur "${t.name}" ainsi que toutes ses données de suivi ?`)) {
                              deleteTracker(t.id);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-low)',
                            cursor: 'pointer',
                            padding: '4px',
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
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                        {/* Period pill */}
                        <span style={{ 
                          fontSize: '0.62rem', 
                          fontWeight: 700, 
                          backgroundColor: 'rgba(255,255,255,0.04)', 
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-med)',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          {t.periodicity === 'daily' ? '🔄 Quotidien' 
                           : t.periodicity === 'hebdo' ? '📅 Hebdo'
                           : t.periodicity === 'month' ? '🗓️ Mensuel'
                           : '⏱️ Custom'}
                        </span>
                        
                        {/* Unit pill */}
                        <span style={{ 
                          fontSize: '0.62rem', 
                          fontWeight: 700, 
                          backgroundColor: 'rgba(168, 85, 247, 0.08)',
                          border: '1px solid rgba(168, 85, 247, 0.2)',
                          color: 'var(--accent-primary)',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          {t.unit}
                        </span>
                      </div>
                      
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-low)', marginTop: '4px' }}>
                        {logCount} entrée{logCount > 1 ? 's' : ''} enregistrée{logCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Details Section */}
          {activeTracker && (
            <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Detail Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Historique : {activeTracker.name}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-low)', margin: '4px 0 0 0' }}>
                    Mesures de type « {activeTracker.unit} », saisie attendue : {
                      activeTracker.periodicity === 'daily' ? 'Chaque jour' 
                      : activeTracker.periodicity === 'hebdo' ? 'Toutes les semaines'
                      : activeTracker.periodicity === 'month' ? 'Chaque mois'
                      : 'Fréquence libre'
                    }.
                  </p>
                </div>
              </div>

              {/* Statistics Board (Numeric indicators) */}
              {stats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-low)', textTransform: 'uppercase', fontWeight: 700 }}>Dernière Valeur</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {stats.latest} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-med)' }}>{activeTracker.unit}</span>
                      {stats.trend === 'up' && <TrendingUp size={16} style={{ color: 'var(--accent-success)' }} />}
                      {stats.trend === 'down' && <TrendingDown size={16} style={{ color: '#fb7185' }} />}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-low)', textTransform: 'uppercase', fontWeight: 700 }}>Moyenne</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                      {stats.avg} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-med)' }}>{activeTracker.unit}</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-low)', textTransform: 'uppercase', fontWeight: 700 }}>Max</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                      {stats.max} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-med)' }}>{activeTracker.unit}</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-low)', textTransform: 'uppercase', fontWeight: 700 }}>Min</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                      {stats.min} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-med)' }}>{activeTracker.unit}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Log Input Form */}
              <form onSubmit={handleCreateLog} style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 180px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-med)' }}>Date de saisie</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius-sm)',
                      padding: '8px 10px',
                      fontSize: '0.8rem',
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '2 1 240px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-med)' }}>
                    Valeur mesurée ({activeTracker.unit})
                  </label>
                  <input
                    type="text"
                    value={logValue}
                    onChange={(e) => setLogValue(e.target.value)}
                    placeholder="Ex: 75.3 ou 'moyen' ou 'très bonne séance'..."
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius-sm)',
                      padding: '8px 10px',
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
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '9px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: 'var(--shadow-neon-primary)',
                    transition: 'var(--transition-fast)',
                    height: '37px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                  onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                >
                  <Plus size={14} />
                  Enregistrer
                </button>

                {logErrorMsg && (
                  <div style={{ width: '100%', color: '#fca5a5', fontSize: '0.72rem', marginTop: '4px' }}>
                    ⚠️ {logErrorMsg}
                  </div>
                )}
              </form>

              {/* Logs Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-med)', margin: '4px 0' }}>
                  Historique Chronologique ({activeLogs.length} entrée{activeLogs.length > 1 ? 's' : ''})
                </h4>

                {activeLogs.length === 0 ? (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-low)', fontStyle: 'italic' }}>
                    Aucune entrée saisie pour le moment. Renseignez votre première donnée ci-dessus !
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                    {activeLogs.map(l => (
                      <div
                        key={l.id}
                        className="tracker-item-row"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          backgroundColor: 'rgba(255,255,255,0.01)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--border-radius-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Calendar size={14} style={{ color: 'var(--text-low)' }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>
                            {new Date(l.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span style={{
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            color: 'var(--accent-secondary)',
                            backgroundColor: 'rgba(6, 182, 212, 0.05)',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            border: '1px solid rgba(6, 182, 212, 0.15)'
                          }}>
                            {l.value} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-med)' }}>{activeTracker.unit}</span>
                          </span>

                          <button
                            onClick={() => {
                              if (window.confirm("Voulez-vous supprimer cette mesure ?")) {
                                deleteTrackerLog(l.id);
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
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Creation form & DB Config (Flex 35%) */}
        <div className="tracking-right-panel" style={{ flex: '1 1 35%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Form container */}
          <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px' }}>
            <form onSubmit={handleCreateTracker} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff' }}>
                Créer un Indicateur
              </h3>

              {/* Status alerts */}
              {errorMsg && (
                <div style={{ 
                  backgroundColor: 'rgba(244,63,94,0.08)', 
                  border: '1px solid rgba(244,63,94,0.2)', 
                  color: '#fca5a5', 
                  borderRadius: 'var(--border-radius-md)', 
                  padding: '12px', 
                  fontSize: '0.78rem'
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}
              
              {successMsg && (
                <div style={{ 
                  backgroundColor: 'rgba(16,185,129,0.08)', 
                  border: '1px solid rgba(16,185,129,0.2)', 
                  color: '#a7f3d0', 
                  borderRadius: 'var(--border-radius-md)', 
                  padding: '12px', 
                  fontSize: '0.78rem'
                }}>
                  ✔️ {successMsg}
                </div>
              )}

              {/* Name input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-med)' }}>Nom de la donnée</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Poids, Sommeil, Productivité..."
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '10px 12px',
                    fontSize: '0.82rem',
                    color: '#ffffff',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Unit input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-med)' }}>Unité de mesure</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Ex: kg, heures, sur 10, pas..."
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '10px 12px',
                    fontSize: '0.82rem',
                    color: '#ffffff',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Periodicity choice */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-med)' }}>Périodicité attendue</label>
                <div style={{
                  display: 'flex',
                  backgroundColor: 'rgba(255,255,255,0.01)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '2px'
                }}>
                  {([
                    { val: 'daily', label: 'Journalier' },
                    { val: 'hebdo', label: 'Hebdo' },
                    { val: 'month', label: 'Mensuel' },
                    { val: 'custom', label: 'Perso' }
                  ] as const).map(({ val, label }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPeriodicity(val)}
                      style={{
                        flex: 1,
                        background: periodicity === val ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--border-radius-sm)',
                        padding: '8px 2px',
                        fontSize: '0.72rem',
                        fontWeight: periodicity === val ? 700 : 500,
                        color: periodicity === val ? '#ffffff' : 'var(--text-med)',
                        cursor: 'pointer'
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit btn */}
              <button
                type="submit"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: 'var(--shadow-neon-primary)',
                  marginTop: '10px',
                  transition: 'var(--transition-fast)'
                }}
                onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
              >
                <Plus size={14} />
                Créer l'Indicateur
              </button>
            </form>
          </div>

          {/* Supabase migration helper (accordéon) */}
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
                  Synchronisation Supabase Cloud
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
                    Si vous utilisez une base de données cloud Supabase pour votre compte, vous devez créer les tables de tracking pour stocker les mesures sur le serveur.
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: 'var(--accent-success)', backgroundColor: 'rgba(16,185,129,0.06)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <Info size={12} style={{ flexShrink: 0 }} />
                    <span>En attendant, le stockage local (`LocalStorage`) prend le relais de manière transparente !</span>
                  </div>

                  <div style={{ position: 'relative', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-low)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      Script SQL de Migration
                    </span>
                    <pre style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '10px',
                      fontSize: '0.62rem',
                      color: '#a7f3d0',
                      overflowX: 'auto',
                      maxHeight: '180px',
                      fontFamily: 'monospace',
                      margin: 0
                    }}>
                      {sqlQueryText}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
