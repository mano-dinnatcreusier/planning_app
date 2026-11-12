#!/usr/bin/env python3
"""planning : tâches du jour de Planning App, en ligne de commande (pour la conversation « Journée »).

Accès Supabase : une session propre à cet outil (distincte de celle du téléphone), dont le refresh
token est gardé dans ~/.config/vigie/planning.json (mode 600). Les règles d'accès (RLS) s'appliquent :
l'outil ne voit et ne modifie que les données du compte de Mano. Pas de clé service_role.

Exemples :
  planning login                         # affiche une adresse à ouvrir sur le téléphone (Tailscale)
  planning tasks add "Appeler le garage" --suggest-goal 2
  planning tasks add "Courses" --date demain
  planning tasks add "Réserver le contrôle technique" --week     # tâche de la semaine (lundi → dimanche)
  planning tasks list [--date hier|demain|2026-11-12] [--json]    # tâches du jour + de la semaine
  planning tasks done 3                  # 3 = numéro dans la liste du jour, S2 = 2e tâche de la semaine
  planning goals list
  planning metrics                       # report des tâches + carte Vigie ~/.local/state/vigie/metrics/planning.json
  planning strava connect                # une fois : relier Strava (lecture seule) pour les km de course
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import fcntl
import html
import json
import os
import re
import secrets
import socket
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

CONFIG = Path(os.environ.get("PLANNING_CONFIG", Path.home() / ".config/vigie/planning.json"))
# Carte épinglée Planning App en haut de Vigie (contrat : vigie/docs/metriques.md, « Carte épinglée »)
METRICS = Path(os.environ.get("PLANNING_METRICS", Path.home() / ".local/state/vigie/metrics/planning.json"))
WEEKS = 16  # semaines d'historique des séries
STRAVA_CONFIG = Path(os.environ.get("PLANNING_STRAVA_CONFIG", Path.home() / ".config/vigie/strava.json"))
STRAVA_WEB = os.environ.get("PLANNING_STRAVA_WEB", "https://www.strava.com")         # autorisation et jetons
STRAVA_API = os.environ.get("PLANNING_STRAVA_API", "https://www.strava.com/api/v3")  # données
RUN_TYPES = {"Run", "TrailRun", "VirtualRun"}
APP_URL = "https://mano-dinnatcreusier.github.io/planning_app/"
EMAIL_DOMAIN = "planning.app"  # même règle que l'app : un identifiant sans @ devient <id>@planning.app
LOGIN_PORT = 8766


class PlanningError(Exception):
    pass


class MissingTables(PlanningError):
    pass


# ---------------------------------------------------------------- dates (heure locale, Europe/Paris)

def today() -> dt.date:
    return dt.date.today()


def parse_date(s: str | None) -> dt.date:
    if not s:
        return today()
    k = s.strip().lower()
    named = {"today": 0, "aujourd'hui": 0, "aujourdhui": 0, "auj": 0, "tomorrow": 1, "demain": 1,
             "yesterday": -1, "hier": -1, "après-demain": 2, "apres-demain": 2}
    if k in named:
        return today() + dt.timedelta(days=named[k])
    if re.fullmatch(r"[+-]\d+", k):
        return today() + dt.timedelta(days=int(k))
    try:
        return dt.date.fromisoformat(k)
    except ValueError:
        raise PlanningError(f"date illisible : {s!r} (YYYY-MM-DD, demain, hier, +2…)")


def monday(d: dt.date) -> dt.date:
    """Lundi de la semaine ISO de d (les tâches de la semaine sont datées de leur lundi)."""
    return d - dt.timedelta(days=d.weekday())


def scope_date(scope: str, d: dt.date) -> dt.date:
    return monday(d) if scope == "week" else d


# ---------------------------------------------------------------- configuration et session

def load_config() -> dict:
    try:
        return json.loads(CONFIG.read_text())
    except FileNotFoundError:
        raise PlanningError("pas encore connecté : lancer `planning login`")
    except ValueError:
        raise PlanningError(f"{CONFIG} illisible : relancer `planning login`")


def save_config(cfg: dict) -> None:
    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    tmp = CONFIG.with_suffix(".json.tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(cfg, f, indent=1)
    os.chmod(tmp, 0o600)
    os.replace(tmp, CONFIG)


@contextmanager
def config_lock():
    """Un seul rafraîchissement de jeton à la fois (minuteur et conversation peuvent tourner ensemble)."""
    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG.with_suffix(".lock"), "w") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def http(method: str, url: str, headers: dict, body=None, timeout: float = 20):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers={**headers, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            try:
                return r.status, (json.loads(raw) if raw else None)
            except ValueError:
                raise PlanningError(f"réponse inattendue (pas du JSON) de {urllib.parse.urlparse(url).netloc}")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, {"message": raw.decode(errors="replace")[:300]}
    except urllib.error.URLError as e:
        raise PlanningError(f"Supabase injoignable : {e.reason}")


def store_session(cfg: dict, sess: dict) -> dict:
    cfg.update(access_token=sess["access_token"], refresh_token=sess["refresh_token"],
               expires_at=int(sess.get("expires_at") or time.time() + int(sess.get("expires_in", 3600))),
               user_id=sess.get("user", {}).get("id", cfg.get("user_id")),
               email=sess.get("user", {}).get("email", cfg.get("email")))
    save_config(cfg)
    return cfg


def session() -> dict:
    cfg = load_config()
    if cfg.get("access_token") and cfg.get("expires_at", 0) - 60 > time.time():
        return cfg
    with config_lock():
        cfg = load_config()  # un autre processus a peut-être rafraîchi entre-temps
        if cfg.get("access_token") and cfg.get("expires_at", 0) - 60 > time.time():
            return cfg
        st, body = http("POST", f"{cfg['supabase_url']}/auth/v1/token?grant_type=refresh_token",
                        {"apikey": cfg["anon_key"]}, {"refresh_token": cfg["refresh_token"]})
        if st != 200:
            msg = (body or {}).get("error_description") or (body or {}).get("msg") or (body or {}).get("message") or st
            raise PlanningError(f"session expirée ou révoquée ({msg}) : relancer `planning login`")
        return store_session(cfg, body)


def rest(method: str, table: str, params: dict | None = None, body=None, prefer: str | None = None):
    cfg = session()
    url = f"{cfg['supabase_url']}/rest/v1/{table}"
    if params:
        url += "?" + urllib.parse.urlencode(params, safe="(),.*:")
    headers = {"apikey": cfg["anon_key"], "Authorization": f"Bearer {cfg['access_token']}"}
    if prefer:
        headers["Prefer"] = prefer
    st, data = http(method, url, headers, body)
    if st >= 400:
        msg = (data or {}).get("message", "") if isinstance(data, dict) else str(data)
        code = (data or {}).get("code", "") if isinstance(data, dict) else ""
        if code in ("PGRST205", "42P01") or "Could not find the table" in msg or \
                (code == "PGRST200" and "daily_task" in msg):
            raise MissingTables("tables des tâches du jour absentes : la migration "
                                "supabase/migrations/20261111_daily_tasks.sql doit être exécutée dans la console Supabase")
        raise PlanningError(f"Supabase {st} : {msg or data}")
    return data


# ---------------------------------------------------------------- report et lecture

def rollover() -> int:
    """Tâche du jour pas faite d'un jour passé → aujourd'hui (postponed_count += jours).
    Tâche de la semaine pas faite d'une semaine passée → semaine en cours (postponed_count += semaines).
    Mise à jour conditionnelle (task_date inchangée) : l'app et l'outil peuvent le faire en même temps
    sans compter deux fois."""
    n = 0
    for scope, target, unit in (("day", today(), 1), ("week", monday(today()), 7)):
        rows = rest("GET", "daily_tasks", {"select": "id,task_date,postponed_count", "scope": f"eq.{scope}",
                                           "is_done": "eq.false", "task_date": f"lt.{target.isoformat()}"})
        for r in rows:
            steps = max(1, (target - dt.date.fromisoformat(r["task_date"])).days // unit)
            rest("PATCH", "daily_tasks", {"id": f"eq.{r['id']}", "task_date": f"eq.{r['task_date']}"},
                 {"task_date": target.isoformat(), "postponed_count": r["postponed_count"] + steps}, prefer="return=minimal")
        n += len(rows)
    return n


TASK_SELECT = "id,title,scope,task_date,original_date,is_done,done_at,order_index,postponed_count,source,created_at," \
              "daily_task_goals(goal_id,status,final_goals(title))"


def tasks_for(d: dt.date, scope: str = "day") -> list[dict]:
    return rest("GET", "daily_tasks", {"select": TASK_SELECT, "scope": f"eq.{scope}",
                                       "task_date": f"eq.{scope_date(scope, d).isoformat()}",
                                       "order": "order_index.asc,created_at.asc"})


def goals(include_done: bool = False) -> list[dict]:
    p = {"select": "id,title,status,target_date", "order": "target_date.asc.nullslast,title.asc"}
    if not include_done:
        p["status"] = "neq.completed"
    return rest("GET", "final_goals", p)


def resolve_task(ref: str, d: dt.date | None) -> dict:
    """ref = numéro dans la liste du jour (1, 2…), S1, S2… dans celle de la semaine, ou début de l'id."""
    m = re.fullmatch(r"([sS]?)(\d{1,3})", ref)
    if m:
        scope = "week" if m.group(1) else "day"
        lst = tasks_for(d or today(), scope)
        i = int(m.group(2))
        if not 1 <= i <= len(lst):
            where = f"la semaine du {monday(d or today()).isoformat()}" if scope == "week" else f"le {(d or today()).isoformat()}"
            raise PlanningError(f"pas de tâche {ref} pour {where} ({len(lst)} tâches)")
        return lst[i - 1]
    lo = (today() - dt.timedelta(days=60)).isoformat()
    lst = rest("GET", "daily_tasks", {"select": TASK_SELECT, "task_date": f"gte.{lo}"})
    hits = [t for t in lst if t["id"].startswith(ref.lower())]
    if len(hits) != 1:
        raise PlanningError(f"tâche {ref!r} : {len(hits)} correspondances")
    return hits[0]


def resolve_goal(ref: str, cache: list[dict]) -> dict:
    """ref = numéro dans `planning goals list` ou début de l'id."""
    if re.fullmatch(r"\d{1,3}", ref):
        i = int(ref)
        if not 1 <= i <= len(cache):
            raise PlanningError(f"pas d'objectif n°{i} ({len(cache)} objectifs en cours)")
        return cache[i - 1]
    hits = [g for g in goals(include_done=True) if g["id"].startswith(ref.lower())]
    if len(hits) != 1:
        raise PlanningError(f"objectif {ref!r} : {len(hits)} correspondances")
    return hits[0]


# ---------------------------------------------------------------- carte Vigie (planning.json)

def write_card(metrics: list[dict], series: list[dict]) -> None:
    METRICS.parent.mkdir(parents=True, exist_ok=True)
    doc = {"updated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "metrics": metrics[:3]}
    if series:  # sans séries, Vigie affiche son exemple : on n'écrit pas de série vide
        doc["series"] = series
    tmp = METRICS.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    os.replace(tmp, METRICS)


def task_metrics() -> list[dict]:
    day, week = tasks_for(today(), "day"), tasks_for(today(), "week")
    dd, wd = sum(t["is_done"] for t in day), sum(t["is_done"] for t in week)
    tone = lambda done, lst: "good" if lst and done == len(lst) else "neutral"
    carried = lambda lst: sum(1 for t in lst if t["postponed_count"] > 0 and not t["is_done"])
    m = monday(today())
    return [
        {"label": "Tâches du jour", "value": f"{dd}/{len(day)}", "tone": tone(dd, day),
         "detail": f"{dd} faite(s) sur {len(day)} aujourd'hui" + (f", {carried(day)} reportée(s) d'un jour précédent" if carried(day) else "")},
        {"label": "Tâches de la semaine", "value": f"{wd}/{len(week)}", "tone": tone(wd, week),
         "detail": f"semaine du {m.strftime('%d/%m')} au {(m + dt.timedelta(days=6)).strftime('%d/%m')}"
                   + (f", {carried(week)} reportée(s) d'une semaine précédente" if carried(week) else "")},
    ]


def strong_series() -> list[dict]:
    """Séances (bâtons) et séries (courbe) Strong par semaine, sur les WEEKS dernières semaines.
    Une série compte si elle a au moins 1 rep (les lignes « Rest Timer » de l'import Strong sont à 0)."""
    t = today()
    first_week = monday(t) - dt.timedelta(weeks=WEEKS - 1)
    since = first_week
    workouts = rest("GET", "strong_workouts", {"select": "id,date", "date": f"gte.{since.isoformat()}", "order": "date.asc"})
    day_of = {}
    for w in workouts:
        try:
            day_of[w["id"]] = dt.date.fromisoformat(str(w["date"])[:10])
        except ValueError:
            continue
    sets_per_day: dict[dt.date, int] = {}
    ids = list(day_of)
    for i in range(0, len(ids), 30):  # ~30 séances par requête : reste sous la limite de 1000 lignes
        chunk = ids[i:i + 30]
        rows = rest("GET", "strong_workout_sets", {"select": "workout_id", "workout_id": f"in.({','.join(chunk)})",
                                                   "reps": "gt.0", "limit": "5000"})
        for r in rows:
            d = day_of[r["workout_id"]]
            sets_per_day[d] = sets_per_day.get(d, 0) + 1
    weeks = [first_week + dt.timedelta(weeks=k) for k in range(WEEKS)]
    sessions_w = {wk: 0 for wk in weeks}
    sets_w = {wk: 0 for wk in weeks}
    for wid, d in day_of.items():
        if monday(d) in sessions_w:
            sessions_w[monday(d)] += 1
    for d, n in sets_per_day.items():
        if monday(d) in sets_w:
            sets_w[monday(d)] += n
    return [
        # Graphique combiné voulu par Mano : bâtons = séances par semaine, courbe (autre couleur, autre échelle)
        # = séries par semaine, avec les deux chiffres de la semaine en cours (rendu par Vigie).
        {"label": "Séances Strong", "unit": "", "value": sessions_w[monday(t)],
         "value_label": f"semaine {t.isocalendar()[1]}",
         "weeks": [[wk.isoformat(), sessions_w[wk]] for wk in weeks],
         "line": {"label": "Séries", "unit": "", "value": sets_w[monday(t)], "value_label": f"semaine {t.isocalendar()[1]}",
                  "weeks": [[wk.isoformat(), sets_w[wk]] for wk in weeks]}},
    ]


# ---------------------------------------------------------------- Strava (km de course, lecture seule)

def save_private(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=1)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def strava_form(url: str, fields: dict):
    data = urllib.parse.urlencode(fields).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, method="POST"), timeout=20) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except ValueError:
            return e.code, {}
    except urllib.error.URLError as e:
        raise PlanningError(f"Strava injoignable : {e.reason}")


def strava_token() -> dict:
    try:
        cfg = json.loads(STRAVA_CONFIG.read_text())
    except FileNotFoundError:
        raise PlanningError("Strava pas encore relié : lancer `planning strava connect`")
    if cfg.get("expires_at", 0) - 120 > time.time():
        return cfg
    with config_lock():
        cfg = json.loads(STRAVA_CONFIG.read_text())
        if cfg.get("expires_at", 0) - 120 > time.time():
            return cfg
        st, body = strava_form(f"{STRAVA_WEB}/oauth/token", {"client_id": cfg["client_id"], "client_secret": cfg["client_secret"],
                                                            "grant_type": "refresh_token", "refresh_token": cfg["refresh_token"]})
        if st != 200:
            raise PlanningError(f"accès Strava refusé ({st}) : relancer `planning strava connect`")
        cfg.update(access_token=body["access_token"], refresh_token=body["refresh_token"], expires_at=int(body["expires_at"]))
        save_private(STRAVA_CONFIG, cfg)
        return cfg


def strava_runs(since: dt.date) -> list[dict]:
    """Activités de course depuis `since` : [{"date": date locale, "km": float}]."""
    cfg = strava_token()
    after = int(dt.datetime.combine(since, dt.time()).timestamp())
    runs, page = [], 1
    while page <= 10:
        url = f"{STRAVA_API}/athlete/activities?" + urllib.parse.urlencode({"after": after, "per_page": 200, "page": page})
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {cfg['access_token']}"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                acts = json.loads(r.read())
        except urllib.error.HTTPError as e:
            raise PlanningError(f"Strava {e.code} : " + ("limite de requêtes atteinte" if e.code == 429 else e.reason))
        except urllib.error.URLError as e:
            raise PlanningError(f"Strava injoignable : {e.reason}")
        for a in acts:
            if (a.get("sport_type") or a.get("type")) in RUN_TYPES:
                runs.append({"date": dt.date.fromisoformat(a["start_date_local"][:10]), "km": (a.get("distance") or 0) / 1000})
        if len(acts) < 200:
            break
        page += 1
    return runs


def run_series() -> dict | None:
    """Km de course par semaine (Strava). None si Strava n'est pas relié : Vigie garde alors son exemple."""
    if not STRAVA_CONFIG.exists():
        return None
    t = today()
    first_week = monday(t) - dt.timedelta(weeks=WEEKS - 1)
    km_day: dict[dt.date, float] = {}
    for r in strava_runs(first_week - dt.timedelta(days=6)):
        km_day[r["date"]] = km_day.get(r["date"], 0.0) + r["km"]
    weeks = [first_week + dt.timedelta(weeks=k) for k in range(WEEKS)]
    km_w = {wk: 0.0 for wk in weeks}
    for d, km in km_day.items():
        if monday(d) in km_w:
            km_w[monday(d)] += km
    rolling, day = [], first_week
    while day <= t:
        rolling.append([day.isoformat(), round(sum(km_day.get(day - dt.timedelta(days=k), 0.0) for k in range(7)), 1)])
        day += dt.timedelta(days=1)
    return {"label": "Course à pied", "unit": "km", "value": round(km_w[monday(t)], 1), "value_label": "cette semaine",
            "weeks": [[wk.isoformat(), round(km_w[wk], 1)] for wk in weeks], "rolling7": rolling}


STRAVA_PAGE = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Planning : relier Strava</title>
<style>body{{font:16px system-ui;background:#0f1115;color:#e8e8ea;margin:0;padding:24px}}
form,div.c{{max-width:420px;margin:auto;display:flex;flex-direction:column;gap:12px}}
input,button{{font:inherit;padding:12px;border-radius:8px;border:1px solid #333;background:#1a1d24;color:inherit}}
button{{background:#fc4c02;border:0;font-weight:600}}p,li{{color:#9aa0a6}}code{{color:#e8e8ea}}.err{{color:#f87171}}</style></head><body>
<form method="post"><h2>Relier Strava (lecture seule)</h2>
<p>1. Sur <a href="https://www.strava.com/settings/api" style="color:#fc4c02">strava.com/settings/api</a>, crée une application :</p>
<ul><li>Nom : <code>Planning Mano</code> (au choix), catégorie : <code>Visualizer</code></li>
<li>Site web : <code>{site}</code></li>
<li>Authorization Callback Domain : <code>{domain}</code></li></ul>
<p>2. Recopie ici son Client ID et son Client Secret (ils restent sur le mini-PC).</p>{msg}
<input name="client_id" placeholder="Client ID" inputmode="numeric" required>
<input name="client_secret" placeholder="Client Secret" autocomplete="off" required>
<button>Continuer vers Strava</button>
<p>3. Strava te demandera d'autoriser la lecture de tes activités : accepte.</p></form></body></html>"""


def cmd_strava_connect(a):
    host = a.host or tailscale_ip()
    shown = a.public_host or tailscale_name() or host
    path = secrets.token_urlsafe(12)
    base = f"http://{shown}:{a.port}/{path}"
    state = secrets.token_urlsafe(12)
    pending: dict = {}
    result: dict = {}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def page(self, code, body, location=None):
            self.send_response(code)
            if location:
                self.send_header("Location", location)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body.encode())

        def form(self, msg=""):
            return STRAVA_PAGE.format(site=html.escape(APP_URL), domain=html.escape(shown), msg=msg)

        def do_GET(self):
            u = urllib.parse.urlparse(self.path)
            if u.path == f"/{path}":
                return self.page(200, self.form())
            if u.path != f"/{path}/callback" or not pending:
                return self.page(404, "introuvable")
            q = urllib.parse.parse_qs(u.query)
            if q.get("state", [""])[0] != state:
                return self.page(400, "requête inattendue")
            if "error" in q or "code" not in q:
                return self.page(200, self.form('<p class="err">Autorisation refusée sur Strava. Réessaie.</p>'))
            scope = q.get("scope", [""])[0]
            if "activity:read" not in scope:
                return self.page(200, self.form('<p class="err">Il faut cocher la lecture des activités sur Strava.</p>'))
            st, body = strava_form(f"{STRAVA_WEB}/oauth/token", {"client_id": pending["client_id"], "client_secret": pending["client_secret"],
                                                                "code": q["code"][0], "grant_type": "authorization_code"})
            if st != 200:
                return self.page(200, self.form(f'<p class="err">Strava a refusé l\'échange ({st}). Vérifie le Client Secret.</p>'))
            save_private(STRAVA_CONFIG, {"client_id": pending["client_id"], "client_secret": pending["client_secret"],
                                         "access_token": body["access_token"], "refresh_token": body["refresh_token"],
                                         "expires_at": int(body["expires_at"]), "scope": scope,
                                         "athlete": (body.get("athlete") or {}).get("firstname", "")})
            result["ok"] = True
            self.page(200, "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
                           "<body style='font:18px system-ui;background:#0f1115;color:#a7f3d0;padding:24px'>"
                           "✔ Strava relié (lecture seule). Tu peux fermer cette page.</body>")
            threading.Thread(target=srv.shutdown, daemon=True).start()

        def do_POST(self):
            if self.path != f"/{path}":
                return self.page(404, "introuvable")
            n = int(self.headers.get("Content-Length", 0))
            form = urllib.parse.parse_qs(self.rfile.read(min(n, 4096)).decode())
            cid, secret = form.get("client_id", [""])[0].strip(), form.get("client_secret", [""])[0].strip()
            if not cid.isdigit() or len(secret) < 20:
                return self.page(200, self.form('<p class="err">Client ID (chiffres) ou Client Secret invalide.</p>'))
            pending.update(client_id=cid, client_secret=secret)
            auth = f"{STRAVA_WEB}/oauth/authorize?" + urllib.parse.urlencode({
                "client_id": cid, "response_type": "code", "redirect_uri": f"{base}/callback",
                "approval_prompt": "auto", "scope": "activity:read_all", "state": state})
            self.page(303, "", location=auth)

    srv = HTTPServer((host, a.port), H)
    print(f"Ouvre sur ton téléphone (Tailscale) : {base}", flush=True)
    print(f"(page valable {a.timeout // 60} min)", flush=True)
    threading.Timer(a.timeout, srv.shutdown).start()
    srv.serve_forever()
    srv.server_close()
    if not result:
        raise PlanningError("délai dépassé, Strava pas relié")
    print("Strava relié.")
    after_change()


def cmd_strava_status(a):
    s = run_series()
    if s is None:
        print("Strava pas encore relié : `planning strava connect`")
        return
    print(f"Strava relié. Course à pied : {s['value']} km cette semaine ; 16 semaines : {[w[1] for w in s['weeks']]}")


def refresh_card() -> dict:
    """Écrit planning.json. Les tâches et Strong sont indépendants : l'un peut manquer sans bloquer l'autre."""
    errors = []
    try:
        metrics = task_metrics()
    except MissingTables:
        metrics = [{"label": "Tâches du jour", "value": "—", "tone": "neutral",
                    "detail": "migration Supabase des tâches du jour en attente"}]
    except PlanningError as e:
        metrics, _ = [], errors.append(e)
    try:
        series = strong_series()
    except PlanningError as e:
        series, _ = [], errors.append(e)
    try:
        runs = run_series()  # 3e série : km de course (Strava), absente tant que Strava n'est pas relié
        if runs and series:
            series.append(runs)
    except PlanningError as e:
        print(f"planning : {e}", file=sys.stderr)  # Strava en panne ne bloque pas le reste de la carte
    if errors and not metrics and not series:
        write_card([{"label": "Planning", "value": "—", "tone": "neutral", "detail": f"accès Supabase à refaire : {errors[0]}"[:200]}], [])
        raise errors[0]
    write_card(metrics, series)
    return {"metrics": metrics, "series": series}


def after_change() -> None:
    try:
        rollover()
    except PlanningError:
        pass
    try:
        refresh_card()
    except PlanningError:
        pass


# ---------------------------------------------------------------- affichage

def fmt_task(i, t: dict) -> str:
    box = "[x]" if t["is_done"] else "[ ]"
    s = f"{i}. {box} {t['title']}  ({t['id'][:8]})"
    if t["postponed_count"]:
        unit = "semaine(s)" if t.get("scope") == "week" else "jour(s)"
        s += f"  ↻ reportée de {t['postponed_count']} {unit} (prévue le {t['original_date']})"
    for g in t.get("daily_task_goals") or []:
        mark = "[x]" if g["status"] == "confirmed" else "[ ]"
        title = (g.get("final_goals") or {}).get("title", "?")
        s += f"\n      {mark} objectif : {title} ({g['goal_id'][:8]}, {'coché par Mano' if g['status'] == 'confirmed' else 'proposé'})"
    return s


def out(data, as_json: bool, text: str) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=1) if as_json else text)


# ---------------------------------------------------------------- commandes

def cmd_tasks_list(a):
    after_change()
    d = parse_date(a.date)
    day, week = tasks_for(d, "day"), tasks_for(d, "week")
    m = monday(d)
    text = (f"Tâches du {d.isoformat()} : {sum(t['is_done'] for t in day)}/{len(day)} faites"
            + ("".join("\n" + fmt_task(i, t) for i, t in enumerate(day, 1)) or "\n(aucune)")
            + f"\n\nTâches de la semaine du {m.isoformat()} au {(m + dt.timedelta(days=6)).isoformat()} : "
            + f"{sum(t['is_done'] for t in week)}/{len(week)} faites"
            + ("".join("\n" + fmt_task(f"S{i}", t) for i, t in enumerate(week, 1)) or "\n(aucune)"))
    out({"date": d.isoformat(), "week_start": m.isoformat(), "day": day, "week": week}, a.json, text)


def add_task(title: str, d: dt.date, goal_refs: list[str], gcache: list[dict] | None, scope: str = "day") -> dict:
    title = title.strip()
    d = scope_date(scope, d)
    if not title:
        raise PlanningError("titre vide")
    resolved = []
    if goal_refs:
        gcache = gcache if gcache is not None else goals()
        resolved = list({g["id"]: g for g in (resolve_goal(r, gcache) for r in goal_refs)}.values())  # sans doublon
    last = rest("GET", "daily_tasks", {"select": "order_index", "scope": f"eq.{scope}", "task_date": f"eq.{d.isoformat()}",
                                       "order": "order_index.desc", "limit": "1"})
    order = (last[0]["order_index"] + 1) if last else 0
    row = rest("POST", "daily_tasks", body={"title": title, "scope": scope, "task_date": d.isoformat(), "original_date": d.isoformat(),
                                             "order_index": order, "source": "journee"},
               prefer="return=representation")[0]
    if resolved:
        try:
            rest("POST", "daily_task_goals", body=[{"task_id": row["id"], "goal_id": g["id"], "status": "proposed"} for g in resolved],
                 prefer="return=minimal")
        except PlanningError:
            rest("DELETE", "daily_tasks", {"id": f"eq.{row['id']}"}, prefer="return=minimal")  # pas de tâche à moitié créée
            raise
    row["proposed_goals"] = [{"id": g["id"], "title": g["title"]} for g in resolved]
    return row


def cmd_tasks_add(a):
    row = add_task(a.title, parse_date(a.date), a.suggest_goal or [], None, a.scope)
    after_change()
    gl = "".join(f"\n   objectif proposé : {g['title']}" for g in row["proposed_goals"])
    out(row, a.json, f"Ajoutée {when(row)} : {row['title']} ({row['id'][:8]}){gl}")


def when(row: dict) -> str:
    if row.get("scope") == "week":
        return f"pour la semaine du {row['task_date']}"
    return f"le {row['task_date']}"


def cmd_tasks_import(a):
    """stdin : JSON [{"title": "...", "date": "demain", "week": false, "goals": ["2", "ab12cd34"]}, ...]"""
    try:
        items = json.load(sys.stdin)
    except ValueError as e:
        raise PlanningError(f"JSON invalide sur l'entrée standard : {e}")
    if not isinstance(items, list):
        raise PlanningError("attendu : une liste JSON de tâches")
    gcache = goals() if any(it.get("goals") for it in items) else None
    def scope_of(it):
        if it.get("scope") in ("day", "week"):
            return it["scope"]
        return "week" if it.get("week") is True else ("day" if it.get("week") is False else a.scope)
    rows = [add_task(it["title"], parse_date(it.get("date") or a.date), [str(g) for g in it.get("goals") or []], gcache,
                     scope_of(it)) for it in items]
    after_change()
    out(rows, a.json, f"{len(rows)} tâche(s) ajoutée(s) :" + "".join(
        f"\n- {when(r)} : {r['title']}" + "".join(f" [objectif proposé : {g['title']}]" for g in r["proposed_goals"]) for r in rows))


def set_done(a, done: bool):
    t = resolve_task(a.ref, parse_date(a.date) if a.date else None)
    rest("PATCH", "daily_tasks", {"id": f"eq.{t['id']}"},
         {"is_done": done, "done_at": dt.datetime.now(dt.timezone.utc).isoformat() if done else None}, prefer="return=minimal")
    after_change()
    print(f"{'Faite' if done else 'Pas faite'} : {t['title']}")


def cmd_tasks_rm(a):
    t = resolve_task(a.ref, parse_date(a.date) if a.date else None)
    rest("DELETE", "daily_tasks", {"id": f"eq.{t['id']}"}, prefer="return=minimal")
    after_change()
    print(f"Supprimée : {t['title']}")


def cmd_tasks_move(a):
    t = resolve_task(a.ref, parse_date(a.date) if a.date else None)
    to = scope_date(t["scope"], parse_date(a.to))
    rest("PATCH", "daily_tasks", {"id": f"eq.{t['id']}"}, {"task_date": to.isoformat()}, prefer="return=minimal")
    after_change()
    print(f"Déplacée {when({'scope': t['scope'], 'task_date': to.isoformat()})} : {t['title']}")


def cmd_tasks_rename(a):
    t = resolve_task(a.ref, parse_date(a.date) if a.date else None)
    rest("PATCH", "daily_tasks", {"id": f"eq.{t['id']}"}, {"title": a.title.strip()}, prefer="return=minimal")
    print(f"Renommée : {t['title']} → {a.title.strip()}")


def cmd_tasks_suggest(a):
    t = resolve_task(a.ref, parse_date(a.date) if a.date else None)
    g = resolve_goal(a.goal, goals())
    rest("POST", "daily_task_goals", {"on_conflict": "task_id,goal_id"},
         {"task_id": t["id"], "goal_id": g["id"], "status": "proposed"}, prefer="resolution=ignore-duplicates,return=minimal")
    print(f"Objectif proposé pour « {t['title']} » : {g['title']} (case à cocher par Mano)")


def cmd_goals_list(a):
    lst = goals(a.all)
    text = "Objectifs " + ("(tous)" if a.all else "en cours") + " :" + ("".join(
        f"\n{i}. {g['title']}  ({g['id'][:8]}" + (f", échéance {g['target_date']}" if g.get("target_date") else "") +
        (", terminé" if g["status"] == "completed" else "") + ")" for i, g in enumerate(lst, 1)) or "\n(aucun)")
    out(lst, a.json, text)


def cmd_metrics(a):
    n = 0
    try:
        n = rollover()
    except MissingTables:
        pass
    card = refresh_card()
    if not a.quiet:
        pills = " · ".join(f"{m['label']} {m['value']}" for m in card["metrics"])
        ser = " · ".join(f"{x['label']} {x['value']} ({x['value_label']})" for x in card["series"])
        print(f"{pills}\n{ser}\n({n} tâche(s) reportée(s) ce passage) → {METRICS}")


def cmd_status(a):
    cfg = load_config()
    session()
    print(f"Connecté : {cfg.get('email')} (Supabase {urllib.parse.urlparse(cfg['supabase_url']).hostname})")
    try:
        rest("GET", "daily_tasks", {"select": "id", "limit": "1"})
        print("Tables des tâches du jour : présentes")
    except MissingTables as e:
        print(f"Tables des tâches du jour : ABSENTES ({e})")


# ---------------------------------------------------------------- connexion

def discover_supabase() -> tuple[str, str]:
    """L'URL et la clé anon de Supabase sont publiques (incluses dans l'app publiée) : on les lit là,
    sans les afficher."""
    try:
        page = urllib.request.urlopen(APP_URL, timeout=20).read().decode()
        js = re.search(r'src="\.?/?(assets/index-[^"]+\.js)"', page).group(1)
        bundle = urllib.request.urlopen(urllib.parse.urljoin(APP_URL, js), timeout=30).read().decode()
    except Exception as e:
        raise PlanningError(f"impossible de lire l'app publiée pour trouver Supabase : {e}")
    url = re.search(r"https://[a-z0-9]{10,40}\.supabase\.co", bundle)
    key = None
    for m in re.finditer(r"eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+", bundle):
        try:
            payload = json.loads(base64.urlsafe_b64decode(m.group(1) + "=="))
        except ValueError:
            continue
        if payload.get("role") == "anon":
            key = m.group(0)
            break
    if not key:
        m = re.search(r"sb_publishable_[A-Za-z0-9_-]{20,}", bundle)
        key = m.group(0) if m else None
    if not (url and key):
        raise PlanningError("URL ou clé anon Supabase introuvable dans l'app publiée : passer --url et --anon-key")
    return url.group(0), key


def password_login(url: str, key: str, username: str, password: str) -> dict:
    email = username.strip() if "@" in username else f"{username.strip().lower()}@{EMAIL_DOMAIN}"
    st, body = http("POST", f"{url}/auth/v1/token?grant_type=password", {"apikey": key},
                    {"email": email, "password": password})
    if st != 200:
        raise PlanningError((body or {}).get("error_description") or (body or {}).get("msg") or f"refus ({st})")
    cfg = {"supabase_url": url, "anon_key": key, "created_at": int(time.time())}
    return store_session(cfg, body)


LOGIN_PAGE = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Planning : connexion du mini-PC</title>
<style>body{{font:16px system-ui;background:#0f1115;color:#e8e8ea;margin:0;padding:24px}}
form{{max-width:360px;margin:auto;display:flex;flex-direction:column;gap:12px}}
input,button{{font:inherit;padding:12px;border-radius:8px;border:1px solid #333;background:#1a1d24;color:inherit}}
button{{background:#8b5cf6;border:0;font-weight:600}}p{{color:#9aa0a6}}.err{{color:#f87171}}</style></head><body>
<form method="post"><h2>Connecter le mini-PC à Planning App</h2>
<p>Ouvre une session réservée à l'outil <code>planning</code> (la conversation « Journée »).
Ta session sur le téléphone n'est pas touchée. Le mot de passe n'est pas conservé.</p>{msg}
<input name="username" placeholder="Identifiant Planning App" autocomplete="username" required>
<input name="password" type="password" placeholder="Mot de passe" autocomplete="current-password" required>
<button>Connecter</button></form></body></html>"""


def cmd_login(a):
    if a.url and a.anon_key:
        url, key = a.url.rstrip("/"), a.anon_key
    else:
        try:
            old = load_config()
            url, key = old["supabase_url"], old["anon_key"]
        except (PlanningError, KeyError):
            url, key = discover_supabase()
    if a.password:  # dans un terminal
        import getpass
        cfg = password_login(url, key, input("Identifiant : "), getpass.getpass("Mot de passe : "))
        print(f"Connecté : {cfg['email']}")
        return
    path = secrets.token_urlsafe(12)
    host = a.host or tailscale_ip()
    result: dict = {}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def page(self, code, body):
            self.send_response(code)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body.encode())

        def do_GET(self):
            if self.path != f"/{path}":
                return self.page(404, "introuvable")
            self.page(200, LOGIN_PAGE.format(msg=""))

        def do_POST(self):
            if self.path != f"/{path}":
                return self.page(404, "introuvable")
            n = int(self.headers.get("Content-Length", 0))
            form = urllib.parse.parse_qs(self.rfile.read(min(n, 4096)).decode())
            try:
                cfg = password_login(url, key, form.get("username", [""])[0], form.get("password", [""])[0])
            except PlanningError as e:
                return self.page(200, LOGIN_PAGE.format(msg=f'<p class="err">Échec : {html.escape(str(e))}</p>'))
            result["email"] = cfg["email"]
            self.page(200, "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
                           "<body style='font:18px system-ui;background:#0f1115;color:#a7f3d0;padding:24px'>"
                           "✔ Mini-PC connecté. Tu peux fermer cette page.</body>")
            threading.Thread(target=srv.shutdown, daemon=True).start()

    srv = HTTPServer((host, a.port), H)
    shown = a.public_host or tailscale_name() or host
    print(f"Ouvre sur ton téléphone (Tailscale) : http://{shown}:{a.port}/{path}", flush=True)
    print(f"(page valable {a.timeout // 60} min, une seule connexion)", flush=True)
    threading.Timer(a.timeout, srv.shutdown).start()
    srv.serve_forever()
    srv.server_close()
    if result:
        print(f"Connecté : {result['email']}")
        after_change()
    else:
        raise PlanningError("délai dépassé, aucune connexion")


def tailscale_name() -> str | None:
    try:
        import subprocess
        d = json.loads(subprocess.run(["tailscale", "status", "--self", "--json"], capture_output=True, text=True, timeout=5).stdout)
        return d["Self"]["DNSName"].rstrip(".") or None
    except Exception:
        return None


def tailscale_ip() -> str:
    try:
        import subprocess
        ip = subprocess.run(["tailscale", "ip", "-4"], capture_output=True, text=True, timeout=5).stdout.split()
        if ip:
            return ip[0]
    except (OSError, subprocess.SubprocessError):
        pass
    return socket.gethostbyname(socket.gethostname())


# ---------------------------------------------------------------- entrée

def scope_args(x) -> None:
    x.add_argument("--week", dest="scope", action="store_const", const="week", default="day",
                   help="tâche de la semaine (lundi → dimanche, semaine de --date)")
    x.add_argument("--scope", dest="scope", choices=["day", "week"], help="day (défaut) ou week")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="planning", description="Tâches du jour de Planning App.")
    sub = p.add_subparsers(dest="cmd", required=True)

    lg = sub.add_parser("login", help="connecter l'outil au compte Planning App (une fois)")
    lg.add_argument("--password", action="store_true", help="saisie dans le terminal au lieu d'une page web")
    lg.add_argument("--host", help="adresse d'écoute (défaut : IP Tailscale)")
    lg.add_argument("--public-host", default=os.environ.get("PLANNING_LOGIN_HOST"),
                    help="nom affiché dans l'adresse à ouvrir (défaut : nom Tailscale de la machine)")
    lg.add_argument("--port", type=int, default=LOGIN_PORT)
    lg.add_argument("--timeout", type=int, default=900)
    lg.add_argument("--url")
    lg.add_argument("--anon-key")
    lg.set_defaults(fn=cmd_login)

    sub.add_parser("status", help="vérifier la connexion et les tables").set_defaults(fn=cmd_status)

    t = sub.add_parser("tasks", help="tâches du jour").add_subparsers(dest="sub", required=True)
    x = t.add_parser("list", help="lister les tâches d'un jour")
    x.add_argument("--date"); x.add_argument("--json", action="store_true"); x.set_defaults(fn=cmd_tasks_list)
    x = t.add_parser("add", help="ajouter une tâche")
    x.add_argument("title"); x.add_argument("--date", help="défaut : aujourd'hui (demain, 2026-11-12, +2…)")
    x.add_argument("--suggest-goal", action="append", metavar="OBJECTIF",
                   help="objectif proposé (numéro de `planning goals list` ou début d'id), répétable")
    scope_args(x); x.add_argument("--json", action="store_true"); x.set_defaults(fn=cmd_tasks_add)
    x = t.add_parser("import", help='ajouter plusieurs tâches : JSON sur stdin [{"title":…,"date":…,"goals":[…]}]')
    x.add_argument("--date", help="date par défaut des tâches"); scope_args(x); x.add_argument("--json", action="store_true")
    x.set_defaults(fn=cmd_tasks_import)
    for name, fn in (("done", lambda a: set_done(a, True)), ("undo", lambda a: set_done(a, False)), ("rm", cmd_tasks_rm)):
        x = t.add_parser(name, help={"done": "cocher", "undo": "décocher", "rm": "supprimer"}[name])
        x.add_argument("ref", help="numéro dans la liste du jour (3), de la semaine (S2), ou début d'id")
        x.add_argument("--date", help="jour de la liste pour un numéro (défaut : aujourd'hui)")
        x.set_defaults(fn=fn)
    x = t.add_parser("move", help="déplacer une tâche à un autre jour")
    x.add_argument("ref"); x.add_argument("to", help="demain, 2026-11-12…"); x.add_argument("--date")
    x.set_defaults(fn=cmd_tasks_move)
    x = t.add_parser("rename", help="renommer une tâche")
    x.add_argument("ref"); x.add_argument("title"); x.add_argument("--date"); x.set_defaults(fn=cmd_tasks_rename)
    x = t.add_parser("suggest-goal", help="proposer un objectif pour une tâche existante")
    x.add_argument("ref"); x.add_argument("goal"); x.add_argument("--date"); x.set_defaults(fn=cmd_tasks_suggest)

    g = sub.add_parser("goals", help="objectifs long terme").add_subparsers(dest="sub", required=True)
    x = g.add_parser("list", help="objectifs en cours (pour proposer les bons)")
    x.add_argument("--all", action="store_true"); x.add_argument("--json", action="store_true"); x.set_defaults(fn=cmd_goals_list)

    m = sub.add_parser("metrics", help="reporter les tâches non faites et écrire la carte Vigie (planning.json)")
    m.add_argument("--quiet", action="store_true"); m.set_defaults(fn=cmd_metrics)

    sv = sub.add_parser("strava", help="km de course depuis Strava (lecture seule)").add_subparsers(dest="sub", required=True)
    x = sv.add_parser("connect", help="relier Strava une fois (page à ouvrir sur le téléphone)")
    x.add_argument("--host"); x.add_argument("--public-host", default=os.environ.get("PLANNING_LOGIN_HOST"))
    x.add_argument("--port", type=int, default=LOGIN_PORT); x.add_argument("--timeout", type=int, default=1200)
    x.set_defaults(fn=cmd_strava_connect)
    sv.add_parser("status", help="vérifier Strava et afficher les km par semaine").set_defaults(fn=cmd_strava_status)

    a = p.parse_args(argv)
    try:
        a.fn(a)
    except PlanningError as e:
        print(f"planning : {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
