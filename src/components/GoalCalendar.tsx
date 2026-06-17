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
    updateMilestoneDate,
    habits,
    habitLogs,
    toggleHabitLog
  } = useGoals();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [pulseDate, setPulseDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'goal' | 'milestone'>('all');
  const [viewMode, setViewMode] = useState<'month' | 'day'>(() => {
    try {
      return window.innerWidth <= 1024 ? 'day' : 'month';
    } catch (e) {
      return 'month';
    }
  });
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Day navigation handlers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const getFormattedDateFr = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

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
      <style>{`
        @media (max-width: 1024px) {
          .calendar-layout-container {
            flex-direction: column-reverse !important;
          }
          .calendar-main-panel {
            flex: 1 1 100% !important;
          }
          .calendar-sidebar-panel {
            flex: 1 1 100% !important;
            max-height: none !important;
          }
          .day-habits-column {
            order: -1 !important;
          }
        }
      `}</style>

      {/* Calendar Header Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CalendarDays style={{ color: 'var(--accent-primary)' }} />
            Calendrier Planif
          </h1>
          <p style={{ color: 'var(--text-med)', fontSize: '0.95rem' }}>
            Visualisez et planifiez vos jalons par simple glisser-déposer (Drag & Drop).
          </p>
        </div>

        {/* View Toggle */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(255,255,255,0.01)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius-md)',
          padding: '4px',
          height: '42px',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setViewMode('month')}
            style={{
              background: viewMode === 'month' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--border-radius-sm)',
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: viewMode === 'month' ? 'var(--accent-primary)' : 'var(--text-med)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CalendarIcon size={14} />
            Mois
          </button>
          <button
            onClick={() => setViewMode('day')}
            style={{
              background: viewMode === 'day' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--border-radius-sm)',
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: viewMode === 'day' ? 'var(--accent-primary)' : 'var(--text-med)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CalendarDays size={14} />
            Jour
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="calendar-layout-container" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap-reverse' }}>
        
        {/* LEFT / CENTER: Monthly Calendar Grid or Daily View Panel (Flex Grow) */}
        <div className="calendar-main-panel glass" style={{ flex: '1 1 65%', borderRadius: 'var(--border-radius-lg)', padding: '24px', position: 'relative' }}>
          
          {viewMode === 'month' ? (
            <>
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
                  // Find all goals/milestones/habits targeting this dateString
                  const cellGoals = finalGoals.filter(g => g.target_date === dateString);
                  const cellMilestones = milestones.filter(m => m.target_date === dateString);
                  const activeHabits = habits.filter(h => dateString >= h.start_date && dateString <= h.end_date);
                  
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
                      onClick={() => {
                        setSelectedDate(dateString);
                        setViewMode('day');
                      }}
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
                        cursor: 'pointer',
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

                      {/* Habits inside this cell */}
                      {activeHabits.map(h => {
                        const log = habitLogs.find(l => l.habit_id === h.id && l.date === dateString);
                        const logStatus = log ? log.status : null;
                        
                        const badgeBg = logStatus === 'done' 
                          ? 'rgba(16, 185, 129, 0.12)' 
                          : logStatus === 'missed' 
                            ? 'rgba(244, 63, 94, 0.12)' 
                            : 'rgba(255, 255, 255, 0.02)';
                            
                        const borderCol = logStatus === 'done' 
                          ? 'rgba(16, 185, 129, 0.3)' 
                          : logStatus === 'missed' 
                            ? 'rgba(244, 63, 94, 0.3)' 
                            : 'rgba(255, 255, 255, 0.08)';
                            
                        const textCol = logStatus === 'done' 
                          ? '#a7f3d0' 
                          : logStatus === 'missed' 
                            ? '#fca5a5' 
                            : '#cbd5e1';

                        const statusIndicator = logStatus === 'done' 
                          ? '🟢' 
                          : logStatus === 'missed' 
                            ? '🔴' 
                            : '⚪';

                        return (
                          <div
                            key={h.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleHabitLog(h.id, dateString, logStatus);
                            }}
                            style={{
                              backgroundColor: badgeBg,
                              border: `1px solid ${borderCol}`,
                              borderRadius: '4px',
                              padding: '3px 6px',
                              fontSize: '0.66rem',
                              color: textCol,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              transition: 'all 0.15s ease',
                              userSelect: 'none'
                            }}
                            className="glass-interactive"
                            title={`${h.title} (Habitude) - Cliquer pour changer le statut`}
                          >
                            <span style={{ fontSize: '0.55rem', flexShrink: 0 }}>{statusIndicator}</span>
                            <span style={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {h.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Day Header with Navigation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-low)', letterSpacing: '0.05em' }}>
                    Vue Journalière
                  </span>
                  <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '4px 0 0 0', color: '#ffffff', textTransform: 'capitalize' }}>
                    {getFormattedDateFr(selectedDate)}
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={handlePrevDay}
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
                    onClick={handleToday}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      borderRadius: 'var(--border-radius-sm)',
                      padding: '8px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
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
                    Aujourd'hui
                  </button>
                  <button
                    onClick={handleNextDay}
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

              {/* Drag and Drop Reschedule target area */}
              {(() => {
                const isHovered = hoveredDate === selectedDate;
                const isPulsing = pulseDate === selectedDate;

                const borderStyle = isHovered 
                  ? '2px dashed var(--accent-primary)' 
                  : '2px dashed var(--border-color-hover)';

                const glowStyle = isHovered 
                  ? '0 0 15px rgba(168, 85, 247, 0.2)' 
                  : isPulsing 
                    ? '0 0 20px rgba(16, 185, 129, 0.4)' 
                    : 'none';

                const bgStyle = isHovered 
                  ? 'rgba(168, 85, 247, 0.05)' 
                  : 'rgba(255, 255, 255, 0.01)';

                return (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (hoveredDate !== selectedDate) setHoveredDate(selectedDate);
                    }}
                    onDragLeave={() => setHoveredDate(null)}
                    onDrop={(e) => handleDrop(e, selectedDate)}
                    style={{
                      border: borderStyle,
                      borderRadius: 'var(--border-radius-lg)',
                      padding: '20px',
                      textAlign: 'center',
                      backgroundColor: bgStyle,
                      boxShadow: glowStyle,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'default'
                    }}
                  >
                    <CalendarIcon size={24} style={{ color: isHovered ? 'var(--accent-primary)' : 'var(--text-low)', transition: 'all 0.2s ease' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isHovered ? 'var(--text-high)' : 'var(--text-med)' }}>
                      {isHovered ? 'Déposez pour planifier à ce jour !' : 'Déposer ici pour planifier un objectif ou jalon à ce jour'}
                    </span>
                  </div>
                );
              })()}

              {/* Day Contents Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '24px'
              }}>
                {/* 1. Goals Column */}
                <div className="day-goals-column" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: '#ffffff', margin: 0 }}>
                    <Trophy size={16} style={{ color: 'var(--accent-primary)' }} />
                    Objectifs Cibles
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-low)', fontWeight: 500 }}>
                      ({finalGoals.filter(g => g.target_date === selectedDate).length})
                    </span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {finalGoals.filter(g => g.target_date === selectedDate).length === 0 ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-low)', padding: '8px 4px' }}>
                        Aucun objectif final cible aujourd'hui.
                      </span>
                    ) : (
                      finalGoals.filter(g => g.target_date === selectedDate).map(goal => {
                        const isCompleted = goal.status === 'completed' || goal.progress === 100;
                        return (
                          <div
                            key={goal.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, goal.id, 'goal')}
                            className="glass"
                            style={{
                              padding: '12px',
                              borderRadius: 'var(--border-radius-md)',
                              border: '1px solid var(--border-color)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              cursor: 'grab'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                backgroundColor: 'rgba(168, 85, 247, 0.08)',
                                color: 'var(--accent-primary)',
                                padding: '2px 8px',
                                borderRadius: '10px'
                              }}>
                                {goal.difficulty}★
                              </span>
                              {goal.priority && (
                                <span style={{
                                  fontSize: '0.58rem',
                                  fontWeight: 800,
                                  color: goal.priority === 'high' ? '#f43f5e' : 'var(--text-med)'
                                }}>
                                  {goal.priority === 'high' ? '🔥 Haute' : goal.priority === 'low' ? '❄️ Basse' : '⚡ Moyenne'}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', textDecoration: isCompleted ? 'line-through' : 'none' }}>
                              {goal.title}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-low)' }}>
                              Progression: {goal.progress || 0}%
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 2. Milestones Column */}
                <div className="day-milestones-column" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: '#ffffff', margin: 0 }}>
                    <CalendarIcon size={16} style={{ color: 'var(--accent-secondary)' }} />
                    Jalons du Jour
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-low)', fontWeight: 500 }}>
                      ({milestones.filter(m => m.target_date === selectedDate).length})
                    </span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {milestones.filter(m => m.target_date === selectedDate).length === 0 ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-low)', padding: '8px 4px' }}>
                        Aucun jalon planifié pour aujourd'hui.
                      </span>
                    ) : (
                      milestones.filter(m => m.target_date === selectedDate).map(ms => {
                        const isCompleted = ms.status === 'completed';
                        return (
                          <div
                            key={ms.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, ms.id, 'milestone')}
                            className="glass"
                            style={{
                              padding: '12px',
                              borderRadius: 'var(--border-radius-md)',
                              border: '1px solid var(--border-color)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              cursor: 'grab'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                backgroundColor: 'rgba(6, 182, 212, 0.08)',
                                color: 'var(--accent-secondary)',
                                padding: '2px 8px',
                                borderRadius: '10px'
                              }}>
                                {ms.difficulty}★
                              </span>
                              {ms.priority && (
                                <span style={{
                                  fontSize: '0.58rem',
                                  fontWeight: 800,
                                  color: ms.priority === 'high' ? '#f43f5e' : 'var(--text-med)'
                                }}>
                                  {ms.priority === 'high' ? '🔥 Haute' : ms.priority === 'low' ? '❄️ Basse' : '⚡ Moyenne'}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', textDecoration: isCompleted ? 'line-through' : 'none' }}>
                              {ms.title}
                            </span>
                            {ms.description && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-low)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {ms.description}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 3. Habits Column */}
                <div className="day-habits-column" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: '#ffffff', margin: 0 }}>
                    <ListTodo size={16} style={{ color: 'var(--accent-success)' }} />
                    Habitudes Actives
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-low)', fontWeight: 500 }}>
                      ({habits.filter(h => selectedDate >= h.start_date && selectedDate <= h.end_date).length})
                    </span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {habits.filter(h => selectedDate >= h.start_date && selectedDate <= h.end_date).length === 0 ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-low)', padding: '8px 4px' }}>
                        Aucune habitude active pour cette période.
                      </span>
                    ) : (
                      habits.filter(h => selectedDate >= h.start_date && selectedDate <= h.end_date).map(h => {
                        const log = habitLogs.find(l => l.habit_id === h.id && l.date === selectedDate);
                        const logStatus = log ? log.status : null;

                        const badgeBg = logStatus === 'done' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : logStatus === 'missed' 
                            ? 'rgba(244, 63, 94, 0.1)' 
                            : 'rgba(255, 255, 255, 0.02)';
                            
                        const borderCol = logStatus === 'done' 
                          ? 'rgba(16, 185, 129, 0.25)' 
                          : logStatus === 'missed' 
                            ? 'rgba(244, 63, 94, 0.25)' 
                            : 'var(--border-color)';
                            
                        const textCol = logStatus === 'done' 
                          ? '#a7f3d0' 
                          : logStatus === 'missed' 
                            ? '#fca5a5' 
                            : '#ffffff';

                        return (
                          <div
                            key={h.id}
                            onClick={() => toggleHabitLog(h.id, selectedDate, logStatus)}
                            className="glass-interactive"
                            style={{
                              padding: '12px',
                              borderRadius: 'var(--border-radius-md)',
                              backgroundColor: badgeBg,
                              border: `1px solid ${borderCol}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: textCol, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {h.title}
                              </span>
                              {h.description && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-low)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {h.description}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '1.1rem', flexShrink: 0, marginLeft: '8px' }}>
                              {logStatus === 'done' ? '🟢' : logStatus === 'missed' ? '🔴' : '⚪'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
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
