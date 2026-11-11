-- Resserre la sécurité (RLS) de Planning App. À exécuter une fois dans Supabase > SQL Editor.
--
-- Avant : la clé anon (publique, elle est dans le JavaScript publié) permettait de lire et modifier
-- les sous-tâches, les pointages d'habitudes, les séries Strong, les relevés de tracking, ainsi que
-- toutes les lignes sans user_id.
-- Après : chaque ligne n'est accessible qu'au compte connecté qui la possède (directement, ou via
-- son parent : jalon → objectif, série → séance, etc.). Les visiteurs non connectés n'ont plus accès.
--
-- Aucune ligne n'est supprimée. Le script est transactionnel : en cas d'erreur, rien n'est appliqué.
-- Retour arrière possible : 20261111_rls_strict_rollback.sql.

BEGIN;

-- 1. Rattacher au compte les lignes sans user_id que l'app affiche aujourd'hui
--    (séances, exercices, trackers sont lus avec « user_id IS NULL » ; objectifs et habitudes ne le
--    sont pas, on les laisse tels quels pour ne rien faire réapparaître).
DO $$
DECLARE
  n_users int;
  owner uuid;
  n_orphans int;
BEGIN
  SELECT (SELECT count(*) FROM public.strong_workouts  WHERE user_id IS NULL)
       + (SELECT count(*) FROM public.strong_exercises WHERE user_id IS NULL)
       + (SELECT count(*) FROM public.trackers         WHERE user_id IS NULL)
    INTO n_orphans;

  IF n_orphans > 0 THEN
    SELECT count(*) INTO n_users FROM auth.users;
    IF n_users <> 1 THEN
      RAISE EXCEPTION 'Il y a % lignes sans propriétaire et % comptes : impossible de savoir à qui les rattacher. Rien n''a été modifié.', n_orphans, n_users;
    END IF;
    SELECT id INTO owner FROM auth.users;
    UPDATE public.strong_workouts  SET user_id = owner WHERE user_id IS NULL;
    UPDATE public.strong_exercises SET user_id = owner WHERE user_id IS NULL;
    UPDATE public.trackers         SET user_id = owner WHERE user_id IS NULL;
    RAISE NOTICE '% lignes sans propriétaire rattachées au compte %', n_orphans, owner;
  ELSE
    RAISE NOTICE 'Aucune ligne sans propriétaire.';
  END IF;
END $$;

-- 2. Supprimer toutes les politiques existantes de ces tables (y compris d'éventuelles politiques
--    créées à la main), pour qu'aucune règle permissive ne reste en parallèle.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'final_goals', 'milestones', 'subtasks', 'habits', 'habit_logs', 'user_profiles',
      'trackers', 'tracker_logs', 'strong_exercises', 'strong_workouts', 'strong_workout_sets')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.final_goals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trackers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracker_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strong_exercises    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strong_workouts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strong_workout_sets ENABLE ROW LEVEL SECURITY;

-- 3. Tables possédées directement (colonne user_id)
CREATE POLICY own_rows ON public.final_goals      FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_rows ON public.habits           FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_rows ON public.trackers         FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_rows ON public.strong_exercises FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_rows ON public.strong_workouts  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Tables possédées via leur parent
CREATE POLICY own_rows ON public.milestones FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.final_goals g WHERE g.id = milestones.final_goal_id AND g.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.final_goals g WHERE g.id = milestones.final_goal_id AND g.user_id = auth.uid()));

CREATE POLICY own_rows ON public.subtasks FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.milestones m JOIN public.final_goals g ON g.id = m.final_goal_id
                      WHERE m.id = subtasks.milestone_id AND g.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.milestones m JOIN public.final_goals g ON g.id = m.final_goal_id
                      WHERE m.id = subtasks.milestone_id AND g.user_id = auth.uid()));

CREATE POLICY own_rows ON public.habit_logs FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.habits h WHERE h.id = habit_logs.habit_id AND h.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.habits h WHERE h.id = habit_logs.habit_id AND h.user_id = auth.uid()));

CREATE POLICY own_rows ON public.tracker_logs FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.trackers t WHERE t.id = tracker_logs.tracker_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trackers t WHERE t.id = tracker_logs.tracker_id AND t.user_id = auth.uid()));

CREATE POLICY own_rows ON public.strong_workout_sets FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.strong_workouts w WHERE w.id = strong_workout_sets.workout_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.strong_workouts w WHERE w.id = strong_workout_sets.workout_id AND w.user_id = auth.uid()));

-- 5. user_profiles : aucune politique = aucun accès depuis l'app (la table contient une clé IA).
--    L'app n'en a pas besoin : elle garde la configuration IA dans le navigateur (Réglages).
--    Les données restent dans la table, lisibles seulement depuis la console Supabase.

COMMIT;

-- Vérification (facultatif) : doit lister une politique « own_rows » par table, sauf user_profiles.
SELECT tablename, policyname, roles, cmd FROM pg_policies
WHERE schemaname = 'public' ORDER BY tablename;
