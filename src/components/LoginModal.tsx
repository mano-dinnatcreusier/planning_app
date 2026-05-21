import React, { useState } from 'react';
import { useGoals } from '../context/GoalContext';
import { Shield, Lock, User as UserIcon, Sparkles, Activity, Play } from 'lucide-react';

interface LoginModalProps {
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const { login, signup, isSupabaseConnected } = useGoals();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isSupabaseConnected) {
      setErrorMsg("La base de données Supabase n'est pas connectée. Veuillez d'abord la configurer dans l'onglet Config de l'application.");
      return;
    }

    if (!username.trim()) {
      setErrorMsg("Veuillez saisir un nom d'utilisateur.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        await signup(username, password);
        setSuccessMsg("Votre compte a été créé avec succès ! Synchronisation en cours...");
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        await login(username, password);
        setSuccessMsg("Connexion réussie ! Chargement de votre univers...");
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Identifiants incorrects ou erreur réseau.";
      if (msg.includes("Invalid login credentials")) {
        setErrorMsg("Nom d'utilisateur ou mot de passe incorrect.");
      } else if (msg.includes("User already registered")) {
        setErrorMsg("Ce nom d'utilisateur est déjà pris.");
      } else if (msg.toLowerCase().includes("invalid") && msg.toLowerCase().includes("email")) {
        setErrorMsg("Adresse e-mail rejetée par Supabase. Assurez-vous d'avoir désactivé l'option 'Confirm email' dans vos paramètres Supabase (Dashboard > Authentication > Providers > Email > Confirm email) pour permettre la création de comptes de démonstration instantanés.");
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(3, 4, 8, 0.9)',
        backdropFilter: 'blur(16px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.3s ease'
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .login-card {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 8px 32px rgba(168, 85, 247, 0.15), 0 0 1px rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.08);
          max-width: 420px;
          width: 100%;
        }
        .login-input {
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-input:focus {
          border-color: var(--accent-primary) !important;
          box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.2);
        }
      `}</style>

      <div
        className="login-card glass"
        style={{
          borderRadius: 'var(--border-radius-xl)',
          padding: '36px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Subtle Ambient Light Orbs */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          left: '-40px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          opacity: 0.12,
          filter: 'blur(40px)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-40px',
          right: '-40px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'var(--accent-secondary)',
          opacity: 0.12,
          filter: 'blur(40px)',
          pointerEvents: 'none'
        }} />

        {/* Brand Header */}
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
            color: '#ffffff',
            marginBottom: '16px',
            boxShadow: '0 4px 16px rgba(168, 85, 247, 0.35)'
          }}>
            <Shield size={24} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
            {isSignUp ? 'Créer un compte' : 'Accéder à vos objectifs'}
          </h2>
          <p style={{ color: 'var(--text-low)', fontSize: '0.8rem', marginTop: '6px' }}>
            {isSignUp 
              ? 'Rejoignez-nous pour synchroniser votre vie dans le cloud.' 
              : 'Saisissez vos identifiants pour restaurer votre planning.'}
          </p>
        </div>

        {/* Banners */}
        {errorMsg && (
          <div style={{
            backgroundColor: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.2)',
            color: '#fca5a5',
            borderRadius: 'var(--border-radius-md)',
            padding: '12px',
            fontSize: '0.78rem',
            lineHeight: 1.4
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
            fontSize: '0.78rem',
            lineHeight: 1.4
          }}>
            ✔️ {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Nom d'utilisateur */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-med)' }}>Nom d'utilisateur</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-low)', display: 'flex' }}>
                <UserIcon size={16} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: mano"
                disabled={isLoading}
                className="login-input"
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
          </div>

          {/* Mot de passe */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-med)' }}>Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-low)', display: 'flex' }}>
                <Lock size={16} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                disabled={isLoading}
                className="login-input"
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
            {isSignUp && password && password.length < 6 && (
              <span style={{ fontSize: '0.68rem', color: '#fb7185' }}>
                Le mot de passe Supabase doit faire 6 caractères minimum.
              </span>
            )}
          </div>

          {/* Confirmer Mot de passe (SignUp unique) */}
          {isSignUp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-med)' }}>Confirmer le mot de passe</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-low)', display: 'flex' }}>
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••"
                  disabled={isLoading}
                  className="login-input"
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
            </div>
          )}

          {/* Button Submit */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--border-radius-md)',
              padding: '12px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(168, 85, 247, 0.3)',
              marginTop: '8px',
              transition: 'var(--transition-fast)',
              opacity: isLoading ? 0.7 : 1
            }}
            onMouseOver={(e) => { if (!isLoading) e.currentTarget.style.filter = 'brightness(1.1)'; }}
            onMouseOut={(e) => { if (!isLoading) e.currentTarget.style.filter = 'none'; }}
          >
            {isLoading ? (
              <Activity size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {isLoading 
              ? 'Traitement en cours...' 
              : isSignUp 
                ? "Créer mon Compte & Synchroniser" 
                : "Se Connecter à mon Compte"}
          </button>
        </form>

        {/* Mode Toggle Link */}
        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-low)' }}>
          {isSignUp ? "Vous avez déjà un compte ?" : "Nouveau sur l'application ?"}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              fontWeight: 700,
              marginLeft: '6px',
              padding: 0
            }}
          >
            {isSignUp ? 'Se connecter' : 'Créer un profil'}
          </button>
        </div>

        {/* Separator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize: '0.65rem', color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ou</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Offline Demo Option */}
        <button
          onClick={onClose}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            color: 'var(--text-med)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-md)',
            padding: '10px 14px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'var(--transition-fast)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
            e.currentTarget.style.color = 'var(--text-med)';
          }}
        >
          <Play size={14} style={{ color: 'var(--accent-secondary)' }} />
          Continuer en Mode Démo Local (Hors-ligne)
        </button>

      </div>
    </div>
  );
};
