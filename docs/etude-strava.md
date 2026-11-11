# Étude : km de course à pied dans la carte Planning App de Vigie

11/11/2026. C'est une étude seulement : rien n'est construit tant que Mano n'a pas choisi.

Le besoin : la série « Kilomètres de course par semaine » de la carte épinglée (`planning.json`, `series[2]`). Elle comprend un histogramme sur 16 semaines, avec en grand la valeur de la semaine en cours.

## Option 1 : Strava, par son API officielle

C'est faisable. Ce que j'en sais, à revérifier sur developers.strava.com au moment de construire, car Strava a changé ses conditions en 2024 :

- **Inscription :** Mano crée une « API application » sur strava.com/settings/api. Il obtient un `client_id` et un `client_secret`. Le secret reste sur le mini-PC, dans `~/.config/vigie/strava.json` en mode 600, jamais dans le dépôt.
  - Une nouvelle application est limitée à un seul athlète (Mano). Ça suffit pour un usage personnel.
- **Autorisation (OAuth 2, lecture seule) :**
  - Mano autorise lui-même, une fois, avec le scope `activity:read`. Il faut `activity:read_all` s'il a des activités privées.
  - Cela suit le même principe que `planning login` : l'outil affiche une adresse, Mano l'ouvre sur son téléphone et clique sur « Autoriser ». Strava renvoie vers une page servie par le mini-PC via Tailscale. Il faut déclarer le nom Tailscale de la machine comme « Authorization Callback Domain ».
  - Strava renvoie un refresh token. Le jeton d'accès dure environ 6 h et l'outil le renouvelle tout seul.
  - Mano peut révoquer l'accès à tout moment depuis Strava.
- **Lecture :** `GET /api/v3/athlete/activities?after=<16 semaines>&per_page=200`. On garde `sport_type` égal à `Run`, `TrailRun` ou `VirtualRun`, puis on additionne `distance` (en mètres) par semaine ISO.
  - Un appel tous les quarts d'heure reste très loin des limites, qui sont de l'ordre de 100 à 200 requêtes par 15 min.
- **Conditions d'utilisation :** les données ne servent qu'à Mano, sur son propre tableau de bord, sans partage ni entraînement d'IA. Ça reste dans le cadre autorisé. À relire au moment de construire.
- **Coût :** environ une session. L'outil Python est déjà là (`planning strava login`, puis lecture dans `planning metrics`). Rien ne change dans Supabase.
- **Ce que Mano devra faire :** créer l'application Strava (5 min, depuis le téléphone c'est possible), puis cliquer sur « Autoriser » une fois.
- **Risques :** une dépendance à un service tiers dont les conditions bougent, et un secret de plus sur le mini-PC. Si Strava coupe l'accès, la série disparaît simplement de la carte.

## Option 2 : sans Strava, dans Planning App

- **2a, coût nul et possible dès aujourd'hui :** un indicateur dans l'onglet **Tracking** existant, par exemple « Course », en unité « km ». Mano saisit ses km après chaque sortie. L'outil `planning` lirait ses relevés (`tracker_logs`) pour la série. Le seul développement est cette lecture, environ 20 lignes.
- **2b :** un vrai onglet « Courses » (date, distance, durée, allure). C'est plus agréable, mais ça demande une nouvelle table, donc une migration dans la console Supabase, et 1 à 2 sessions. L'ordre des onglets en bas changerait, ou il faudrait le mettre dans un sous-onglet.

## Recommandation

- **Strava (option 1)** si Mano enregistre déjà ses sorties avec : aucune saisie à faire, et l'historique existe déjà.
- **Sinon, l'option 2a**, qui marche tout de suite sans migration.

Tant qu'il n'y a pas de données, l'outil n'écrit pas cette série, et Vigie affiche son exemple.

## Questions pour Mano

1. Enregistres-tu tes courses dans Strava, ou avec une montre qui synchronise vers Strava ?
2. Si oui : d'accord pour créer l'application Strava et autoriser la lecture de tes activités ?
3. Sinon : la saisie manuelle dans Tracking te va-t-elle ?
