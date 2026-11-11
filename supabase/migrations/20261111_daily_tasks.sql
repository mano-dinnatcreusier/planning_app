-- Tâches du jour et de la semaine (« Journée ») et leurs liens vers les objectifs long terme.
-- Migration additive : crée deux tables nouvelles, ne modifie aucune table ni donnée existante.
-- Sans risque à rejouer (IF NOT EXISTS). À exécuter une fois dans Supabase > SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    scope TEXT NOT NULL DEFAULT 'day' CHECK (scope IN ('day', 'week')),
    task_date DATE NOT NULL,                     -- jour prévu (heure de Paris) ; pour 'week' : le lundi de la semaine ISO
    original_date DATE NOT NULL,                 -- task_date à la création, avant tout report
    is_done BOOLEAN NOT NULL DEFAULT FALSE,
    done_at TIMESTAMPTZ,                         -- moment où elle a été cochée (NULL si pas faite)
    order_index INTEGER NOT NULL DEFAULT 0,
    postponed_count INTEGER NOT NULL DEFAULT 0,  -- reports : en jours ('day') ou en semaines ('week')
    source TEXT NOT NULL DEFAULT 'app',          -- 'app' ou 'journee' (dictée à Claude)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT week_starts_monday CHECK (scope = 'day' OR (extract(isodow FROM task_date) = 1 AND extract(isodow FROM original_date) = 1))
);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON public.daily_tasks(user_id, scope, task_date);

-- Lien tâche ↔ objectif. 'proposed' : proposé par Claude, case non cochée.
-- 'confirmed' : coché par Mano. Décocher remet à 'proposed' (la proposition reste visible).
CREATE TABLE IF NOT EXISTS public.daily_task_goals (
    task_id UUID NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES public.final_goals(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed')),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, goal_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_task_goals_goal ON public.daily_task_goals(goal_id);

ALTER TABLE public.daily_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_task_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_rows ON public.daily_tasks;
CREATE POLICY own_rows ON public.daily_tasks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Un lien n'est visible et modifiable que si la tâche ET l'objectif appartiennent au compte.
DROP POLICY IF EXISTS own_rows ON public.daily_task_goals;
CREATE POLICY own_rows ON public.daily_task_goals FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.daily_tasks t WHERE t.id = daily_task_goals.task_id AND t.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.final_goals g WHERE g.id = daily_task_goals.goal_id AND g.user_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.daily_tasks t WHERE t.id = daily_task_goals.task_id AND t.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.final_goals g WHERE g.id = daily_task_goals.goal_id AND g.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_tasks, public.daily_task_goals TO authenticated;

-- Temps réel : une tâche dictée à « Journée » apparaît dans l'app sans recharger.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_tasks, public.daily_task_goals;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
