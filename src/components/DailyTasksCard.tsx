import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarRange, CheckCircle2, Circle, ListChecks, Plus, RotateCcw, Target, Trash2 } from 'lucide-react';
import { useGoals } from '../context/GoalContext';
import { getSupabase } from '../utils/supabaseClient';
import { localToday } from '../utils/strongStats';

// Tâches du jour et de la semaine (« Journée ») : dictées à Claude via l'outil `planning`, cochées ici.
// Une tâche de la semaine porte la date du lundi de sa semaine ISO.
// Données : tables daily_tasks et daily_task_goals (migration 20261111_daily_tasks.sql).

interface TaskGoal { goal_id: string; status: 'proposed' | 'confirmed'; final_goals: { title: string } | null }
interface DailyTask {
  id: string;
  title: string;
  scope: 'day' | 'week';
  task_date: string;
  original_date: string;
  is_done: boolean;
  done_at: string | null;
  order_index: number;
  postponed_count: number;
  daily_task_goals: TaskGoal[];
}

const SELECT = 'id,title,scope,task_date,original_date,is_done,done_at,order_index,postponed_count,daily_task_goals(goal_id,status,final_goals(title))';
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const mondayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = (new Date(y, m - 1, d).getDay() + 6) % 7; // lundi = 0
  return addDays(iso, -wd);
};
const fmtShort = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
};
const isMissingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST205' || e.code === '42P01' || /Could not find the table/.test(e.message || '') ||
    (e.code === 'PGRST200' && /daily_task/.test(e.message || '')));

export const DailyTasksCard: React.FC = () => {
  const { user } = useGoals();
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [tasks, setTasks] = useState<DailyTask[]>([]);       // jour et semaine mélangés, filtrés à l'affichage
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [newTitle, setNewTitle] = useState({ day: '', week: '' });
  const [today, setToday] = useState(localToday());
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const date = day === 'today' ? today : addDays(today, 1);
  const weekStart = mondayOf(date);

  // Report : une tâche du jour pas faite d'un jour passé repart à aujourd'hui (postponed_count += jours) ;
  // une tâche de la semaine pas faite d'une semaine passée repart à la semaine en cours (+= semaines).
  // Mise à jour conditionnelle sur l'ancienne date : pas de double compte avec l'outil du mini-PC.
  const rollover = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const t = localToday();
    for (const [scope, target, unit] of [['day', t, 1], ['week', mondayOf(t), 7]] as const) {
      const { data, error } = await sb.from('daily_tasks').select('id,task_date,postponed_count')
        .eq('scope', scope).eq('is_done', false).lt('task_date', target);
      if (error || !data) return;
      await Promise.all(data.map(r => sb.from('daily_tasks')
        .update({ task_date: target, postponed_count: r.postponed_count + Math.max(1, Math.floor(daysBetween(r.task_date, target) / unit)) })
        .eq('id', r.id).eq('task_date', r.task_date)));
    }
  }, []);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !user) return;
    const t = localToday();
    setToday(t);
    await rollover();
    const target = day === 'today' ? t : addDays(t, 1);
    const { data, error } = await sb.from('daily_tasks').select(SELECT)
      .or(`and(scope.eq.day,task_date.eq.${target}),and(scope.eq.week,task_date.eq.${mondayOf(target)})`)
      .order('order_index', { ascending: true }).order('created_at', { ascending: true });
    if (isMissingTable(error)) { setState('missing'); return; }
    if (error) { setState('error'); setErrorMsg(error.message); return; }
    setTasks((data || []) as unknown as DailyTask[]);
    setState('ready');
  }, [user, day, rollover]);

  const scheduleLoad = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(load, 400);
  }, [load]);

  useEffect(() => { load(); }, [load]);

  // Temps réel (tâche dictée à « Journée ») + retour au premier plan (nouveau jour, autre appareil)
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user || state === 'missing') return;
    const ch = sb.channel('daily-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_tasks' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_task_goals' }, scheduleLoad)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') scheduleLoad(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { sb.removeChannel(ch); document.removeEventListener('visibilitychange', onVisible); };
  }, [user, state, scheduleLoad]);

  const fail = (msg: string) => { setErrorMsg(msg); load(); };

  const toggleTask = async (t: DailyTask) => {
    const done = !t.is_done;
    setTasks(prev => prev.map(x => (x.id === t.id ? { ...x, is_done: done } : x)));
    const { error } = await getSupabase()!.from('daily_tasks')
      .update({ is_done: done, done_at: done ? new Date().toISOString() : null }).eq('id', t.id);
    if (error) fail(`Non enregistré : ${error.message}`);
  };

  // Cocher un objectif = « coché par Mano » ; décocher le remet en simple proposition.
  const toggleGoal = async (t: DailyTask, g: TaskGoal) => {
    const status = g.status === 'confirmed' ? 'proposed' : 'confirmed';
    setTasks(prev => prev.map(x => (x.id !== t.id ? x : {
      ...x, daily_task_goals: x.daily_task_goals.map(y => (y.goal_id === g.goal_id ? { ...y, status } : y)),
    })));
    const { error } = await getSupabase()!.from('daily_task_goals')
      .update({ status, confirmed_at: status === 'confirmed' ? new Date().toISOString() : null })
      .eq('task_id', t.id).eq('goal_id', g.goal_id);
    if (error) fail(`Non enregistré : ${error.message}`);
  };

  const addTask = async (e: React.FormEvent, scope: 'day' | 'week') => {
    e.preventDefault();
    const title = newTitle[scope].trim();
    if (!title) return;
    setNewTitle(v => ({ ...v, [scope]: '' }));
    const d = scope === 'week' ? weekStart : date;
    const order = tasks.filter(x => x.scope === scope).reduce((m, x) => Math.max(m, x.order_index), -1) + 1;
    const { error } = await getSupabase()!.from('daily_tasks')
      .insert({ title, scope, task_date: d, original_date: d, order_index: order, source: 'app', user_id: user!.id });
    if (error) { setNewTitle(v => ({ ...v, [scope]: title })); fail(`Non ajoutée : ${error.message}`); } else load();
  };

  const deleteTask = async (t: DailyTask) => {
    if (!window.confirm(`Supprimer « ${t.title} » ?`)) return;
    setTasks(prev => prev.filter(x => x.id !== t.id));
    const { error } = await getSupabase()!.from('daily_tasks').delete().eq('id', t.id);
    if (error) fail(`Non supprimée : ${error.message}`);
  };

  if (!user || !getSupabase()) return null; // tâches du jour : seulement en mode connecté

  const dayTasks = tasks.filter(t => t.scope === 'day');
  const weekTasks = tasks.filter(t => t.scope === 'week');
  const doneCount = dayTasks.filter(t => t.is_done).length;
  const weekDone = weekTasks.filter(t => t.is_done).length;
  const card: React.CSSProperties = { borderRadius: 'var(--border-radius-lg)', padding: '18px', border: '1px solid rgba(139, 92, 246, 0.25)', display: 'flex', flexDirection: 'column', gap: '12px' };

  const renderList = (list: DailyTask[]) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {list.map(t => (
          <div key={t.id} className="daily-task" style={{ borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '4px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button type="button" onClick={() => toggleTask(t)} aria-pressed={t.is_done} aria-label={`${t.is_done ? 'Décocher' : 'Cocher'} : ${t.title}`}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', textAlign: 'left' }}>
                {t.is_done ? <CheckCircle2 size={22} style={{ color: 'var(--accent-success)', flexShrink: 0 }} /> : <Circle size={22} style={{ color: 'var(--text-low)', flexShrink: 0 }} />}
                <span style={{ fontSize: '0.92rem', fontWeight: 600, color: t.is_done ? 'var(--text-low)' : '#ffffff', textDecoration: t.is_done ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>
                  {t.title}
                </span>
              </button>
              {t.postponed_count > 0 && (
                <span title={`Prévue ${t.scope === 'week' ? 'la semaine du' : 'le'} ${t.original_date}, reportée de ${t.postponed_count} ${t.scope === 'week' ? 'semaine(s)' : 'jour(s)'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', color: t.postponed_count >= 3 ? '#fca5a5' : 'var(--text-low)', flexShrink: 0 }}>
                  <RotateCcw size={11} />{t.postponed_count}{t.scope === 'week' ? ' sem.' : ' j'}
                </span>
              )}
              <button type="button" onClick={() => deleteTask(t)} aria-label={`Supprimer : ${t.title}`}
                style={{ background: 'none', border: 'none', color: 'var(--text-low)', cursor: 'pointer', padding: '8px 6px', flexShrink: 0 }}>
                <Trash2 size={13} />
              </button>
            </div>
            {t.daily_task_goals.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 4px 6px 36px' }}>
                {t.daily_task_goals.map(g => (
                  <button key={g.goal_id} type="button" onClick={() => toggleGoal(t, g)} aria-pressed={g.status === 'confirmed'}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 0', textAlign: 'left',
                      fontSize: '0.78rem', color: g.status === 'confirmed' ? '#c4b5fd' : 'var(--text-low)' }}>
                    <span style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      border: g.status === 'confirmed' ? '1px solid #8b5cf6' : '1px dashed var(--text-low)', background: g.status === 'confirmed' ? '#8b5cf6' : 'transparent',
                      color: '#ffffff', fontSize: '0.65rem', fontWeight: 800 }}>
                      {g.status === 'confirmed' ? '✓' : ''}
                    </span>
                    <Target size={12} style={{ flexShrink: 0 }} />
                    <span style={{ overflowWrap: 'anywhere' }}>{g.final_goals?.title || 'Objectif'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
  );

  const renderAdd = (scope: 'day' | 'week') => (
    <form onSubmit={e => addTask(e, scope)} style={{ display: 'flex', gap: '8px' }}>
      <input value={newTitle[scope]} onChange={e => setNewTitle(v => ({ ...v, [scope]: e.target.value }))}
        placeholder={scope === 'week' ? 'Ajouter une tâche de la semaine…' : day === 'today' ? 'Ajouter une tâche…' : 'Ajouter une tâche pour demain…'}
        aria-label={scope === 'week' ? 'Nouvelle tâche de la semaine' : 'Nouvelle tâche du jour'}
        style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '10px 12px', fontSize: '0.85rem', color: '#ffffff', outline: 'none' }} />
      <button type="submit" aria-label="Ajouter" disabled={!newTitle[scope].trim()}
        style={{ background: '#8b5cf6', border: 'none', borderRadius: 'var(--border-radius-md)', color: '#ffffff', padding: '0 14px', cursor: 'pointer', opacity: newTitle[scope].trim() ? 1 : 0.5 }}>
        <Plus size={16} />
      </button>
    </form>
  );

  if (state === 'missing') {
    return (
      <div className="glass" style={card}>
        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ListChecks size={18} /> Tâches du jour
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-low)' }}>
          Bientôt ici : il reste une mise à jour à faire dans la console Supabase (migration « daily_tasks »).
        </span>
      </div>
    );
  }

  return (
    <div className="glass" style={card} data-testid="daily-tasks">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ListChecks size={18} style={{ color: '#a78bfa' }} />
          Tâches {day === 'today' ? 'du jour' : 'de demain'}
          {state === 'ready' && dayTasks.length > 0 && (
            <span style={{ fontSize: '0.85rem', color: doneCount === dayTasks.length ? 'var(--accent-success)' : '#a78bfa' }}>
              {doneCount}/{dayTasks.length}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '999px', padding: '3px' }}>
          {(['today', 'tomorrow'] as const).map(k => (
            <button key={k} type="button" onClick={() => setDay(k)}
              style={{ border: 'none', borderRadius: '999px', padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                background: day === k ? '#8b5cf6' : 'transparent', color: day === k ? '#ffffff' : 'var(--text-med)' }}>
              {k === 'today' ? "Aujourd'hui" : 'Demain'}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>⚠️ {errorMsg}</span>}
      {state === 'loading' && <span style={{ fontSize: '0.8rem', color: 'var(--text-low)' }}>Chargement…</span>}
      {state === 'ready' && dayTasks.length === 0 && (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-low)' }}>
          Aucune tâche {day === 'today' ? "aujourd'hui" : 'demain'}. Dicte-les à « Journée » ou ajoute-les ici.
        </span>
      )}

      {renderList(dayTasks)}
      {renderAdd('day')}

      {/* Tâches de la semaine (lundi → dimanche), section à part sous celles du jour */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }} data-testid="week-tasks">
        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <CalendarRange size={16} style={{ color: '#a78bfa' }} />
          Semaine du {fmtShort(weekStart)} au {fmtShort(addDays(weekStart, 6))}
          {state === 'ready' && weekTasks.length > 0 && (
            <span style={{ fontSize: '0.82rem', color: weekDone === weekTasks.length ? 'var(--accent-success)' : '#a78bfa' }}>
              {weekDone}/{weekTasks.length}
            </span>
          )}
        </span>
        {state === 'ready' && weekTasks.length === 0 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-low)' }}>Aucune tâche pour cette semaine.</span>
        )}
        {renderList(weekTasks)}
        {renderAdd('week')}
      </div>
    </div>
  );
};
