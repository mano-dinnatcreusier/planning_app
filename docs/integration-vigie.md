# Intégrer Planning App dans Vigie

État au 11/11/2026, sur la branche `docs/integration-vigie`. C'est une étude : aucun code n'est modifié, ni ici ni dans Vigie.

## 1. Ce que fait l'app aujourd'hui

### Fonctions

On a quatre onglets, appelés « piliers » dans le code (`src/App.tsx`, `src/components/MobileNav.tsx`) :

| Onglet | Composant | Ce qu'il fait |
|---|---|---|
| **Quotidien** | `HabitsView.tsx` (1 300 lignes) | Routines (habitudes) quotidiennes, hebdomadaires ou « N jours par semaine ». Pointage du jour (fait ou raté), séries, pourcentage du jour. L'IA peut suggérer des habitudes. |
| **Tracking** | `TrackingView.tsx` (1 170 lignes) | Indicateurs libres (nom, unité, périodicité) et leurs relevés datés. La valeur est un texte libre. |
| **Strong** | `StrongView.tsx` (2 060 lignes) | Musculation : import du CSV exporté par l'app Strong, séances, séries, exercices, statistiques. |
| **Objectifs** | `GoalsHubView`, `Dashboard`, `GoalTimeline`, `GoalCalendar` | Objectifs finaux → jalons → sous-tâches. Système de points (heures × difficulté × coefficients), progression calculée, frise et calendrier. L'IA évalue un objectif et propose des sous-tâches. |

Autres éléments :
- **Connexion :** Supabase Auth. Un identifiant sans `@` devient `<identifiant>@planning.app` (`LoginModal.tsx`, `GoalContext.tsx:777`).
- **Réglages :** URL et clé Supabase, clé et modèle IA, SQL du schéma à copier, données de démo, effacement de la base (`SettingsModal.tsx`).
- **IA :** une API compatible OpenAI, DeepSeek par défaut, appelée directement depuis le navigateur (`src/utils/aiClient.ts`).

Taille : environ 13 400 lignes de TSX et CSS, dont 2 100 dans `src/context/GoalContext.tsx`, qui contient tout l'état, toute la synchro et tous les appels à la base. Les styles sont surtout écrits directement dans les composants. Il n'y a aucun test.

### Modèle de données

Il est défini dans `src/types.ts`. Le SQL de référence est dans `SettingsModal.tsx` (il n'y a pas de fichier `.sql`).

```
final_goals ─┬─< milestones ─< subtasks
             └─(goal_ids[])── habits ─< habit_logs (habit_id, date) → done | missed
trackers ─< tracker_logs (date, value texte)
strong_exercises      strong_workouts ─< strong_workout_sets (exercise_name, weight, reps, set_order)
user_profiles (user_id, ai_api_key, ai_model)
```

Il n'y a **pas d'entité « tâche » ni « objectif de la semaine »**. Les choses les plus proches sont :
- les sous-tâches des jalons, sans date propre ;
- les jalons et les objectifs, avec une `target_date` ;
- les habitudes à pointer aujourd'hui.

Voir les questions de la section 6.

### Où sont les données

1. **Supabase (Postgres hébergé) : c'est la source de vérité** dès qu'on est connecté. 11 tables, Realtime activé. Chaque modification relance un `loadAllData()` après un anti-rebond de 2 s. La synchro se relance aussi quand l'onglet revient au premier plan.
2. **localStorage : un cache et un mode hors ligne.** Clés `fg_goals`, `fg_milestones`, `fg_subtasks`, `fg_habits`, `fg_habit_logs`, `fg_trackers`, `fg_tracker_logs`, `fg_strong_exercises`, `fg_strong_workouts`. Au premier login, ce qui n'existe que localement est envoyé dans Supabase (« auto-migration »). Le localStorage contient aussi la session Supabase, `supabase_url` et `supabase_anon_key`, et `fg_ai_url`, `fg_ai_key` et `fg_ai_model`.
3. **Le CSV à la racine** (`strong4826414958642021836.csv`, 8 950 lignes) est un **export brut de l'app Strong**, de mars 2023 à aujourd'hui. Il est identique à `public/strong.csv`, que l'onglet Strong sait importer d'un clic. Ce n'est pas un stockage de l'app, seulement une source d'import.

Le build GitHub Pages reçoit `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` depuis les secrets du dépôt (`.github/workflows/deploy.yml`). `vite.config.ts` a `base: './'`, donc le build peut être servi depuis n'importe quel sous-chemin.

### Points d'attention trouvés en lisant le code

Ils sont indépendants de l'intégration, mais certains comptent pour la migration.

- **Données personnelles publiques.** Le dépôt est public, et `public/strong.csv` part dans `dist/`. L'historique complet de musculation est donc lisible par n'importe qui, dans le dépôt et à l'URL GitHub Pages `/strong.csv`.
- **RLS trop permissive.**
  - Les politiques de `subtasks` et `habit_logs` sont `USING (true)`.
  - Les autres tables acceptent `user_id IS NULL`.
  - La clé anon est forcément publique (elle est dans le JavaScript publié).
  - Résultat : quiconque la récupère peut lire et modifier ces lignes.
- **Clé IA stockée en clair** dans `user_profiles.ai_api_key` et dans le localStorage.
- **Date du jour calculée en UTC** (`new Date().toISOString().split('T')[0]`, par exemple `HabitsView.tsx:204`). Entre minuit et 1 h ou 2 h, heure de Paris, une habitude est pointée sur la veille. Cela fausserait aussi une métrique « aujourd'hui » dans Vigie.

## 2. Vigie, vu depuis Planning App

Vigie compte 550 lignes :
- `server/app.py` : FastAPI, un jeton `X-Vigie-Token`, `/api/overview`, start et stop des sessions ;
- `web/` : vanilla JS sans build, avec les métriques en haut et les bulles des projets.

Tout est servi par `StaticFiles` monté sur `/`, sur l'IP Tailscale, port 8765. Le registre est `projects.yaml`. Planning App y figure déjà (`id: planning`), avec un champ `dashboards` qui ne sert aujourd'hui qu'à des liens externes.

Ce qui facilite l'intégration :
- **Même origine.** Si Planning App est servie par Vigie (`/planning/`), elle partage le localStorage de Vigie. Elle peut donc appeler `/api/...` avec le jeton `vigie-token` déjà saisi, sans nouvelle connexion côté Vigie.
- **Supabase reste joignable depuis le mini-PC et depuis le téléphone.** Aucune donnée n'a besoin de bouger pour l'intégration elle-même.

## 3. Les trois options

### Option A : intégrer le code React tel quel

On construit Planning App (`vite build`) et Vigie sert `dist/` sous `/planning/`. L'app garde sa base Supabase et son code. Vigie ajoute :
- un point d'API de métriques ;
- un bouton « Ouvrir Planning » sur la bulle, qui navigue dans l'app au lieu d'ouvrir un onglet externe.

Côté Planning App, on ajoute une barre « ← Vigie » et l'appel aux métriques, et on aligne le thème.

- **Coût : faible.** Côté Planning App, 1 à 2 sessions : chemin de base, barre de retour, envoi et lecture des métriques, script de build. Côté Vigie, environ 60 lignes (voir la section 5).
- **Risques :**
  - Deux technologies dans le même produit (vanilla pour l'accueil, React pour le module). Passer de l'un à l'autre recharge la page. C'est « dans l'app », mais pas parfaitement fluide.
  - On garde la dette du code « vibecodé » (le contexte de 2 100 lignes, la synchro par rechargement complet).
  - Il faut une étape de build, donc Node ou Docker sur le mini-PC, ou bien la CI.
- **Données : aucune migration.** Même base Supabase, même compte. La version GitHub Pages continue de marcher en parallèle sur les mêmes données. Une seule chose change : comme l'origine n'est plus la même, le cache localStorage et la session ne suivent pas. Il faut se reconnecter une fois dans Vigie. Les données qui n'existeraient que dans le localStorage de GitHub Pages (jamais synchronisées) y restent jusqu'au prochain login là-bas.

### Option B : recoder le module en vanilla JS, comme le reste de Vigie

On réécrit les quatre onglets sans framework, dans `vigie/web/`.

- **Coût : élevé.** On réécrit environ 13 000 lignes d'interface interactive : glisser-déposer dans le calendrier, frise, graphiques Strong, formulaires à IA. On compte facilement 3 000 à 5 000 lignes de vanilla, et de nombreuses sessions. Sans composants ni état réactif, le code devient vite plus dur à maintenir que le React actuel.
- **Risques :** régressions fonctionnelles (sans tests de référence, impossible de vérifier qu'on n'a rien perdu), longue période avec deux versions à maintenir, et Mano qui perd des fonctions qu'il utilise.
- **Données : deux sous-cas.**
  - On garde Supabase, appelé par `supabase-js` en UMD ou via un proxy côté Vigie : aucune migration.
  - Ou on passe en SQLite sur le mini-PC : export de toutes les tables par l'API REST, import avec **les mêmes UUID**, comparaison des comptes table par table, Supabase gardé en lecture seule comme sauvegarde pendant un mois.
  - Inconvénients de SQLite : le mini-PC devient un point unique de panne, et rien ne marche hors Tailscale ni hors ligne.

### Option C : passer Vigie à React et Vite, et y brancher Planning App

Vigie devient une app React (un shell avec routes). Son accueil (métriques et bulles) est porté en composants, et Planning App y entre comme module de routes (`/planning/...`) partageant le même shell, le même thème et la même navigation.

- **Coût : moyen.**
  - Le portage de Vigie est petit : 150 lignes de JS et 60 de CSS, environ 1 session.
  - Fusionner Planning App comme module demande 1 à 2 sessions : déplacer `src/` dans `vigie/web/src/modules/planning/`, remplacer la barre latérale par la navigation du shell, isoler le CSS global.
  - Le serveur FastAPI ne change presque pas : il sert `web/dist` au lieu de `web/`.
- **Risques :**
  - Vigie perd son principe « sans build » : chaque modification de l'interface demande `npm run build`.
  - Conflits avec la session orchestratrice, qui développe Vigie en vanilla en ce moment : il faut se coordonner, sinon l'un écrase l'autre.
  - Le build Vite demande environ 300 à 600 Mo, à faire tourner sous limite mémoire.
- **Avantages :**
  - Une seule technologie, une vraie navigation sans rechargement.
  - C'est le chemin standard pour Capacitor (`vite build` → `npx cap sync`), qui est justement prévu vers le 15/11.
  - Le code de Planning App est gardé et nettoyé progressivement plutôt que jeté.
- **Données : aucune migration** (Supabase reste), avec la même reconnexion unique que pour l'option A.

### Résumé

| | A : React tel quel | B : vanilla | C : Vigie en React |
|---|---|---|---|
| Coût | faible (2 à 3 sessions) | élevé (10 sessions et plus) | moyen (3 à 5 sessions) |
| Sentiment « natif » | moyen (rechargement entre modules) | bon | bon |
| Risque de perdre des fonctions | nul | élevé | faible |
| Migration des données | aucune | aucune, ou vers SQLite (risquée) | aucune |
| Prépare Capacitor | oui, mais deux interfaces | oui | **oui, chemin standard** |
| Gêne pour l'orchestrateur | faible | moyenne | forte (change la technologie de Vigie) |

## 4. Recommandation

**Ne pas tout recoder. Faire A tout de suite, puis C au moment de passer à Capacitor.**

1. **Ne pas recoder de zéro (pas d'option B).**
   - L'app marche, Mano s'en sert, et ses défauts sont localisés : `GoalContext.tsx`, les styles inline, la RLS, la date en UTC.
   - Une réécriture coûterait 10 sessions ou plus pour revenir au même point, avec un risque réel de perdre des fonctions, et sans gain pour les données.
   - Ce qui mérite d'être réécrit, ce sont des morceaux, pas l'ensemble : découper `GoalContext` en un magasin par pilier, et passer d'une synchro par rechargement complet à des mises à jour fines.
2. **Étape 1, option A (environ 1 semaine de travail réel, réversible).**
   - Planning App est servie par Vigie sous `/planning/`.
   - Les métriques remontent à l'accueil, et l'accueil peut agir dans l'autre sens (voir la section 5).
   - On ne touche pas aux données, et GitHub Pages reste en ligne pendant ce temps.
   - Pendant cette étape, corriger les points urgents : retirer `strong.csv` du dépôt public et du build, resserrer la RLS, calculer la date en heure locale.
3. **Étape 2, option C (au moment de Capacitor).**
   - Le travail de l'étape 1 n'est pas perdu : l'API de métriques, l'accès Supabase côté serveur et le chemin de base sont réutilisés tels quels.
   - Elle doit être décidée par la session orchestratrice et Mano, puisqu'elle change la technologie de Vigie.
   - Si Vigie doit rester sans build, on garde A, et Capacitor emballe simplement le site servi par Vigie, Planning compris.
4. **Supabase reste la base,** au moins jusqu'à l'étape 2. Passer en SQLite sur le mini-PC n'apporte rien de clair et retire l'accès hors Tailscale. Si Mano le veut quand même plus tard, la procédure (mêmes UUID, comparaison des comptes, Supabase gardé en lecture seule) est décrite dans l'option B.

## 5. Ce qu'il faudrait côté Vigie (à faire par la session orchestratrice)

Je ne modifie pas Vigie. Voici ce dont l'étape 1 a besoin.

1. **Servir le build.** Dans `server/app.py`, **avant** le `app.mount("/", ...)` final :
   ```python
   PLANNING_DIST = Path.home() / "Documents/perso/planning_app/dist"
   if PLANNING_DIST.is_dir():
       app.mount("/planning", StaticFiles(directory=PLANNING_DIST, html=True), name="planning")
   ```
   Pas de jeton sur les fichiers statiques : l'app a sa propre connexion Supabase, et Vigie n'écoute que sur Tailscale.
2. **Métriques de Planning vers Vigie : `GET /api/planning/summary`** (avec le jeton). Exemple de réponse, à valider avec Mano :
   ```json
   {"date": "2026-11-11",
    "habits_today": {"done": 3, "due": 5},
    "milestones_week": {"done": 1, "due": 4},
    "next_deadline": {"title": "…", "date": "2026-11-14"},
    "last_workout": "2026-11-09",
    "fresh_at": 1762870000}
   ```
   Deux façons de l'alimenter :
   - **(a) Le serveur lit Supabase lui-même, à la demande** (recommandé, toujours à jour). Il utilise la session de Mano : un refresh token stocké dans `~/.config/vigie/planning.json` (mode 600, saisi une fois depuis l'interface). La RLS s'applique donc, et il n'y a pas de clé `service_role` sur le mini-PC. Il faut environ 40 lignes Python avec `httpx` vers l'API REST de Supabase, plus un cache de 60 s.
   - **(b) Planning App envoie ses chiffres** (`POST /api/planning/summary`) à chaque modification. C'est plus simple, mais les chiffres sont périmés si l'app n'a pas été ouverte (par exemple, les habitudes « dues » ne changent pas à minuit).
3. **Vigie vers Planning (l'autre sens) :** `POST /api/planning/habits/{id}/log` avec `{date, status}`, pour cocher une habitude depuis l'accueil. On réutilise la session de l'option (a). Plus tard, si utile : `POST /api/planning/trackers/{id}/log`. Dans l'autre direction, Planning App peut déjà lire `/api/overview` (même origine, même jeton) si on veut afficher le quota ou la RAM dans le module.
4. **Interface :**
   - des tuiles « Routines du jour 3/5 » et « Jalons de la semaine 1/4 » dans `renderMetrics()` ;
   - sur la bulle Planning, un bouton « Ouvrir » vers `/planning/` dans le même onglet. On peut passer par `dashboards: [{label: Ouvrir Planning, url: /planning/}]`, mais aujourd'hui ces liens s'ouvrent en `target=_blank`.

## 6. Questions pour Mano

1. **Recommandation.** Es-tu d'accord pour A maintenant, puis C au moment de Capacitor, sans réécriture complète ? Et C (Vigie passe à React et Vite) est-il acceptable pour toi et pour la session orchestratrice ?
2. **« Objectifs de la semaine » et « tâches du jour ».** L'app n'a pas ces entités. Pour la remontée vers Vigie, que veux-tu dire par là ?
   - Est-ce que « tâches du jour » = habitudes dues aujourd'hui ? Faut-il ajouter une date aux sous-tâches ?
   - Est-ce que « objectifs de la semaine » = jalons dont la date cible tombe dans la semaine ? Ou veux-tu une vraie liste hebdomadaire, à créer ?
3. **Quelles métriques exactement** sur l'accueil de Vigie, et quelles actions depuis l'accueil (cocher une habitude, ajouter un relevé, autre chose) ?
4. **Données locales.** As-tu utilisé l'app sans être connecté, sur le téléphone ou sur le PC ? Si oui, il faut se connecter une fois sur GitHub Pages depuis cet appareil avant la bascule, pour que l'auto-migration envoie ces données dans Supabase.
5. **Historique Strong public.** Le CSV (mars 2023 à aujourd'hui) est dans le dépôt **public** et sur GitHub Pages. Je le retire du dépôt et du build ? Le retirer de l'historique git demande une réécriture d'historique et un force-push, donc ton accord explicite.
6. **Sécurité Supabase.** Je peux resserrer la RLS (plus de `USING (true)`, plus de `user_id IS NULL`) avec un script SQL que tu exécuteras dans la console Supabase. D'accord ?
7. **Accès serveur à Supabase** pour les métriques : es-tu d'accord pour l'option (a), un refresh token de ta session stocké sur le mini-PC ? Ou préfères-tu (b), l'app qui envoie ses chiffres ?
8. **GitHub Pages :** faut-il le garder après la bascule, comme accès hors Tailscale ? Sinon, quand l'arrêter ?
9. **IA :** garder DeepSeek appelé depuis le navigateur ? Ou passer les appels par le serveur Vigie, pour que la clé ne soit plus dans le navigateur ni dans `user_profiles` ?
10. **Node sur le mini-PC.** Docker est disponible (ton compte est dans le groupe `docker`), donc je propose de builder ainsi, sans rien installer :
    ```
    systemd-run --user --scope -q -p MemoryMax=1500M \
      docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -c "npm ci && npm run build"
    ```
    Autre possibilité : `fnm`, installé dans `~/.local` (sans sudo). Laquelle préfères-tu ? Pour un build local, il faudra aussi les deux variables `VITE_SUPABASE_*` dans un fichier `.env.local`, que tu crées toi-même (je ne lis pas les `.env`).
