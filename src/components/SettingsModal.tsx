import React, { useState } from 'react';
import { useGoals } from '../context/GoalContext';
import { Database, X, CheckCircle, AlertTriangle, Copy, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    supabaseConfig,
    isSupabaseConnected,
    saveSupabaseConfig,
    clearDatabase,
    loadDemoData
  } = useGoals();

  const [url, setUrl] = useState(supabaseConfig.url);
  const [anonKey, setAnonKey] = useState(supabaseConfig.anonKey);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; error: boolean } | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const success = await saveSupabaseConfig(url, anonKey);
    if (success) {
      setStatusMessage({ text: 'Configuration enregistrée et connectée avec succès !', error: false });
      setTimeout(() => onClose(), 1500);
    } else {
      setStatusMessage({ text: 'Échec de la connexion. Vérifiez les informations saisies.', error: true });
    }
  };

  const handleDisconnect = async () => {
    await saveSupabaseConfig('', '');
    setUrl('');
    setAnonKey('');
    setStatusMessage({ text: 'Déconnecté de Supabase. Retour au mode LocalStorage.', error: false });
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
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
);`;

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>SQL pour initialiser Supabase</h3>
            <button
              onClick={copySQL}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                color: 'var(--accent-primary)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copié !' : 'Copier le script SQL'}
            </button>
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
);`}
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
