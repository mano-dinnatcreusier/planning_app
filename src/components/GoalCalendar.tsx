import React, { useState } from 'react';
import { useGoals } from '../context/GoalContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays, 
  Trophy, 
  Calendar as CalendarIcon, 
  Search,
  ListTodo,
  CheckCircle
} from 'lucide-react';

export const GoalCalendar: React.FC = () => {
  const { 
    finalGoals, 
    milestones, 
    updateFinalGoalDate, 
    updateMilestoneDate 
  } = useGoals();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [pulseDate, setPulseDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'goal' | 'milestone'>('all');

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Helper arrays for calendar rendering
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Pure function to generate a 42-day month grid including padding days
  const getDaysInMonthGrid = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Align Mon=0, Sun=6

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const grid: { date: Date; isCurrentMonth: boolean; dateString: string }[] = [];

    // Prev month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      grid.push({
        date: d,
        isCurrentMonth: false,
        dateString: localDateStr
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      grid.push({
        date: d,
        isCurrentMonth: true,
        dateString: localDateStr
      });
    }

    // Next month padding
    const remaining = 42 - grid.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      grid.push({
        date: d,
        isCurrentMonth: false,
        dateString: localDateStr
      });
    }

    return grid;
  };

  const gridDays = getDaysInMonthGrid(currentYear, currentMonth);

  // Month navigation
  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };
  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  // Drag and Drop implementation
  const handleDragStart = (e: React.DragEvent, id: string, type: 'goal' | 'milestone') => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, type }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, dateString: string) => {
    e.preventDefault();
    setHoveredDate(null);
    try {
      const rawData = e.dataTransfer.getData('text/plain');
      if (!rawData) return;
      const { id, type } = JSON.parse(rawData);

      if (type === 'goal') {
        await updateFinalGoalDate(id, dateString);
      } else if (type === 'milestone') {
        await updateMilestoneDate(id, dateString);
      }

      setPulseDate(dateString);
      setTimeout(() => setPulseDate(null), 1000);
    } catch (err) {
      console.error('Drag drop reschedule error:', err);
    }
  };

  // Sidebar list items to schedule
  const itemsToSchedule = React.useMemo(() => {
    let list: { id: string; title: string; type: 'goal' | 'milestone'; date: string; priority?: string; isCompleted: boolean }[] = [];

    // Goals
    finalGoals.forEach(g => {
      list.push({
        id: g.id,
        title: g.title,
        type: 'goal',
        date: g.target_date,
        priority: g.priority,
        isCompleted: g.status === 'completed' || g.progress === 100
      });
    });

    // Milestones
    milestones.forEach(m => {
      list.push({
        id: m.id,
        title: m.title,
        type: 'milestone',
        date: m.target_date,
        priority: m.priority,
        isCompleted: m.status === 'completed'
      });
    });

    // Apply filters
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => item.title.toLowerCase().includes(q));
    }

    if (filterType !== 'all') {
      list = list.filter(item => item.type === filterType);
    }

    return list;
  }, [finalGoals, milestones, searchQuery, filterType]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Calendar Header Title */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CalendarDays style={{ color: 'var(--accent-primary)' }} />
          Calendrier Planif
        </h1>
        <p style={{ color: 'var(--text-med)', fontSize: '0.95rem' }}>
          Visualisez et planifiez vos jalons par simple glisser-déposer (Drag & Drop).
        </p>
      </div>

      {/* Main Container */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap-reverse' }}>
        
        {/* LEFT / CENTER: Monthly Calendar Grid (Flex Grow) */}
        <div className="glass" style={{ flex: '1 1 65%', borderRadius: 'var(--border-radius-lg)', padding: '24px', position: 'relative' }}>
          {/* Calendar Month Navigation Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, textTransform: 'capitalize', color: '#ffffff' }}>
              {monthNames[currentMonth]} {currentYear}
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={prevMonth}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  borderRadius: 'var(--border-radius-sm)',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'var(--transition-fast)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.backgroundColor = 'rgba(168,85,247,0.05)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={nextMonth}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  borderRadius: 'var(--border-radius-sm)',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'var(--transition-fast)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.backgroundColor = 'rgba(168,85,247,0.05)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Column Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px', textAlign: 'center' }}>
            {dayNames.map((day) => (
              <span key={day} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {day}
              </span>
            ))}
          </div>

          {/* Calendar Grid cells (42 cells) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridAutoRows: 'minmax(105px, auto)',
            gap: '8px'
          }}>
            {gridDays.map(({ date, isCurrentMonth, dateString }) => {
              // Find all goals/milestones targeting this dateString
              const cellGoals = finalGoals.filter(g => g.target_date === dateString);
              const cellMilestones = milestones.filter(m => m.target_date === dateString);
              
              const isHovered = hoveredDate === dateString;
              const isPulsing = pulseDate === dateString;
              
              // Dynamic borders and shadows for hovered/pulsing drops
              const borderStyle = isHovered 
                ? '1px solid var(--accent-primary)' 
                : isCurrentMonth 
                  ? '1px solid rgba(255, 255, 255, 0.05)' 
                  : '1px solid rgba(255, 255, 255, 0.015)';

              const glowStyle = isHovered 
                ? '0 0 10px rgba(168, 85, 247, 0.15)' 
                : isPulsing 
                  ? '0 0 18px rgba(16, 185, 129, 0.3)' 
                  : 'none';

              const cellBg = isHovered
                ? 'rgba(168, 85, 247, 0.04)'
                : isCurrentMonth
                  ? 'rgba(255, 255, 255, 0.01)'
                  : 'rgba(255, 255, 255, 0.002)';

              // RPG Urgent indicators: if high priority goals/milestones are here, add light glow
              const hasHighUrgency = cellGoals.some(g => g.priority === 'high' && g.status !== 'completed') || 
                                     cellMilestones.some(m => m.priority === 'high' && m.status !== 'completed');

              return (
                <div
                  key={dateString}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (hoveredDate !== dateString) setHoveredDate(dateString);
                  }}
                  onDragLeave={() => setHoveredDate(null)}
                  onDrop={(e) => handleDrop(e, dateString)}
                  style={{
                    backgroundColor: cellBg,
                    border: borderStyle,
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: glowStyle,
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: isCurrentMonth ? 1 : 0.4
                  }}
                >
                  {/* Urgency Ambient border glow */}
                  {hasHighUrgency && isCurrentMonth && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '2px',
                      background: 'linear-gradient(90deg, #f43f5e, transparent)',
                      boxShadow: '0 0 4px #f43f5e'
                    }} />
                  )}

                  {/* Day Date number */}
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: date.toDateString() === new Date().toDateString() ? 800 : 500,
                    color: date.toDateString() === new Date().toDateString() 
                      ? 'var(--accent-primary)' 
                      : isCurrentMonth ? '#ffffff' : 'var(--text-low)',
                    display: 'inline-flex',
                    width: '18px',
                    height: '18px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    backgroundColor: date.toDateString() === new Date().toDateString() ? 'rgba(168,85,247,0.15)' : 'transparent',
                    marginBottom: '4px'
                  }}>
                    {date.getDate()}
                  </span>

                  {/* Goals inside this cell */}
                  {cellGoals.map(goal => {
                    const isCompleted = goal.status === 'completed' || goal.progress === 100;
                    return (
                      <div
                        key={goal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, goal.id, 'goal')}
                        style={{
                          backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.08)' : 'rgba(168, 85, 247, 0.12)',
                          border: isCompleted ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(168, 85, 247, 0.25)',
                          borderRadius: '4px',
                          padding: '3px 6px',
                          fontSize: '0.68rem',
                          color: isCompleted ? '#a7f3d0' : '#f3e8ff',
                          cursor: 'grab',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          transition: 'var(--transition-fast)'
                        }}
                        className="glass-interactive"
                        title={`${goal.title} (Objectif principal)`}
                      >
                        <Trophy size={10} style={{ flexShrink: 0, color: 'var(--accent-primary)' }} />
                        <span style={{ 
                          textDecoration: isCompleted ? 'line-through' : 'none', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {goal.title.replace(/[^\w\s\dÀ-ÿ🚀🌿🎯💻💰🏃‍♂️🏁]/gi, '').trim()}
                        </span>
                        
                        {/* High Priority Mini Dot */}
                        {goal.priority === 'high' && !isCompleted && (
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#f43f5e', flexShrink: 0, display: 'inline-block', boxShadow: '0 0 4px #f43f5e' }} />
                        )}
                      </div>
                    );
                  })}

                  {/* Milestones inside this cell */}
                  {cellMilestones.map(ms => {
                    const isCompleted = ms.status === 'completed';
                    return (
                      <div
                        key={ms.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, ms.id, 'milestone')}
                        style={{
                          backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.08)' : 'rgba(6, 182, 212, 0.12)',
                          border: isCompleted ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(6, 182, 212, 0.25)',
                          borderRadius: '4px',
                          padding: '3px 6px',
                          fontSize: '0.68rem',
                          color: isCompleted ? '#a7f3d0' : '#ecfeff',
                          cursor: 'grab',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          transition: 'var(--transition-fast)'
                        }}
                        className="glass-interactive"
                        title={`${ms.title} (Jalon)`}
                      >
                        <CalendarIcon size={10} style={{ flexShrink: 0, color: 'var(--accent-secondary)' }} />
                        <span style={{ 
                          textDecoration: isCompleted ? 'line-through' : 'none', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {ms.title}
                        </span>
                        
                        {/* High Priority Mini Dot */}
                        {ms.priority === 'high' && !isCompleted && (
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#f43f5e', flexShrink: 0, display: 'inline-block', boxShadow: '0 0 4px #f43f5e' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Rescheduling / Drag Sidebar (30% Width) */}
        <div className="glass" style={{ flex: '1 1 30%', borderRadius: 'var(--border-radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '740px', overflowY: 'auto' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#ffffff' }}>
              <ListTodo size={16} style={{ color: 'var(--accent-secondary)' }} />
              Planificateur Rapide
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-low)', marginTop: '4px', lineHeight: 1.3 }}>
              Faites glisser des éléments depuis cette liste vers un jour du calendrier pour replanifier.
            </p>
          </div>

          {/* Sidebar controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '8px 12px 8px 32px',
                  fontSize: '0.8rem',
                  color: '#ffffff',
                  outline: 'none'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-low)' }} />
            </div>

            {/* Filter Toggle tabs */}
            <div style={{
              display: 'flex',
              backgroundColor: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-md)',
              padding: '2px'
            }}>
              {(['all', 'goal', 'milestone'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  style={{
                    flex: 1,
                    background: filterType === type ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '6px',
                    fontSize: '0.7rem',
                    fontWeight: filterType === type ? 700 : 500,
                    color: filterType === type ? '#ffffff' : 'var(--text-med)',
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {type === 'all' ? 'Tout' : type === 'goal' ? 'Objectifs' : 'Jalons'}
                </button>
              ))}
            </div>
          </div>

          {/* Draggable Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: 1 }}>
            {itemsToSchedule.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-low)', fontSize: '0.8rem' }}>
                Aucun élément trouvé.
              </div>
            ) : (
              itemsToSchedule.map(item => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id, item.type)}
                  className="glass-interactive"
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--border-color)',
                    cursor: 'grab',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'var(--transition-fast)',
                    opacity: item.isCompleted ? 0.6 : 1
                  }}
                >
                  {/* Card type and priority tags */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      backgroundColor: item.type === 'goal' ? 'rgba(168, 85, 247, 0.08)' : 'rgba(6, 182, 212, 0.08)',
                      color: item.type === 'goal' ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: item.type === 'goal' ? '1px solid rgba(168, 85, 247, 0.12)' : '1px solid rgba(6, 182, 212, 0.12)'
                    }}>
                      {item.type === 'goal' ? '🎯 Objectif' : '🏁 Jalon'}
                    </span>

                    {/* Priority badge */}
                    {item.priority && (
                      <span style={{
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        color: 
                          item.priority === 'high' ? '#f43f5e' : 
                          item.priority === 'low' ? '#38bdf8' : 
                          'var(--accent-warning)',
                      }}>
                        {item.priority === 'high' ? '🔥 Haute' : item.priority === 'low' ? '❄️ Basse' : '⚡ Moyenne'}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <span style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    textDecoration: item.isCompleted ? 'line-through' : 'none'
                  }}>
                    {item.title}
                  </span>

                  {/* Date badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-low)' }}>
                    <CalendarIcon size={12} />
                    <span>{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    {item.isCompleted && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--accent-success)', marginLeft: 'auto', fontWeight: 600 }}>
                        <CheckCircle size={10} /> Fait
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
