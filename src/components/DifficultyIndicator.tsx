import React from 'react';

interface DifficultyIndicatorProps {
  level: number; // 1 to 5
  showLabel?: boolean;
}

export const DifficultyIndicator: React.FC<DifficultyIndicatorProps> = ({ level, showLabel = true }) => {
  const getDifficultyInfo = (lvl: number) => {
    switch (lvl) {
      case 1:
        return { label: 'Trivial', colorClass: 'badge-emerald', style: { '--color': 'var(--accent-success)' } as React.CSSProperties };
      case 2:
        return { label: 'Facile', colorClass: 'badge-cyan', style: { '--color': 'var(--accent-secondary)' } as React.CSSProperties };
      case 3:
        return { label: 'Moyen', colorClass: 'badge-amber', style: { '--color': 'var(--accent-warning)' } as React.CSSProperties };
      case 4:
        return { label: 'Intense', colorClass: 'badge-purple', style: { '--color': 'var(--accent-primary)' } as React.CSSProperties };
      case 5:
        return { label: 'Épique', colorClass: 'badge-rose', style: { '--color': 'var(--accent-danger)' } as React.CSSProperties };
      default:
        return { label: 'Moyen', colorClass: 'badge-amber', style: { '--color': 'var(--accent-warning)' } as React.CSSProperties };
    }
  };

  const { label, colorClass } = getDifficultyInfo(level);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {/* Visual glowing bars */}
      <div style={{ display: 'flex', gap: '3px' }}>
        {[1, 2, 3, 4, 5].map((i) => {
          const isActive = i <= level;
          let barBg = 'rgba(255, 255, 255, 0.08)';
          let glowStyle = {};
          
          if (isActive) {
            if (level === 1) barBg = 'var(--accent-success)';
            else if (level === 2) barBg = 'var(--accent-secondary)';
            else if (level === 3) barBg = 'var(--accent-warning)';
            else if (level === 4) barBg = 'var(--accent-primary)';
            else barBg = 'var(--accent-danger)';

            glowStyle = {
              boxShadow: `0 0 8px ${barBg}`,
              opacity: 1
            };
          }

          return (
            <div
              key={i}
              style={{
                width: '6px',
                height: '14px',
                borderRadius: '2px',
                backgroundColor: barBg,
                transition: 'all 0.3s ease',
                ...glowStyle
              }}
            />
          );
        })}
      </div>

      {showLabel && (
        <span className={`badge ${colorClass}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
          {label}
        </span>
      )}
    </div>
  );
};
