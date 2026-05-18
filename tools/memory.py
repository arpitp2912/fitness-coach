import json
import hashlib
import datetime
from pathlib import Path
from google.adk.tools import FunctionTool

# ── Directory layout ───────────────────────────────────────
# data/
#   users.json              ← credentials for all users
#   profiles/
#     alice.json            ← alice's full profile + progress log
#     bob.json

# Anchor paths to this file's location so they work regardless
# of which directory uvicorn is launched from
_BASE_DIR    = Path(__file__).resolve().parent.parent  # fitness_coach/
USERS_PATH   = _BASE_DIR / "data" / "users.json"
PROFILES_DIR = _BASE_DIR / "data" / "profiles"


# ── Internal helpers ───────────────────────────────────────

def _profile_path(user_id: str) -> Path:
    return PROFILES_DIR / f"{user_id}.json"

def _load_json(path: Path, default):
    if path.exists():
        with open(path, "r") as f:
            return json.load(f)
    return default

def _save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def _today() -> str:
    return datetime.date.today().isoformat()

def _now() -> str:
    return datetime.datetime.now().isoformat()


# ── Auth ───────────────────────────────────────────────────

def register_user(username: str, password: str) -> dict:
    users = _load_json(USERS_PATH, {})
    if username in users:
        return {"ok": False, "error": "Username already taken"}
    users[username] = {
        "password_hash": _hash(password),
        "created_at":    _now(),
        "last_login":    _now(),
    }
    _save_json(USERS_PATH, users)
    return {"ok": True}

def login_user(username: str, password: str) -> dict:
    users = _load_json(USERS_PATH, {})
    if username not in users:
        return {"ok": False, "error": "User not found"}
    if users[username]["password_hash"] != _hash(password):
        return {"ok": False, "error": "Incorrect password"}
    users[username]["last_login"] = _now()
    _save_json(USERS_PATH, users)
    return {"ok": True}


# ── Profile ────────────────────────────────────────────────

def save_user_profile(user_id: str, data: dict) -> str:
    path    = _profile_path(user_id)
    profile = _load_json(path, {})
    profile.update(data)
    _save_json(path, profile)
    return f"Profile saved for {user_id}"

def get_user_profile(user_id: str) -> dict:
    return _load_json(_profile_path(user_id), {})


# ── Progress log ───────────────────────────────────────────

def append_progress_log(user_id: str, entry: dict) -> str:
    """Append a timestamped progress entry and recalculate active streak."""
    path    = _profile_path(user_id)
    profile = _load_json(path, {})
    log     = profile.get("progress_log", [])

    today = _today()
    log.append({"timestamp": _now(), "date": today, **entry})
    profile["progress_log"] = log

    # Recalculate streak from all logged dates
    logged_dates = sorted({e.get("date", "") for e in log if e.get("date")})
    streak = 0
    check  = datetime.date.today()
    for _ in range(len(logged_dates)):
        if check.isoformat() in logged_dates:
            streak += 1
            check  -= datetime.timedelta(days=1)
        else:
            break

    profile["streak_days"]     = streak
    profile["last_active"]     = today
    profile["total_log_days"]  = len(logged_dates)

    _save_json(path, profile)
    return f"Progress logged for {user_id}. Current streak: {streak} days."

def get_progress_log(user_id: str) -> list:
    return _load_json(_profile_path(user_id), {}).get("progress_log", [])


# ── Stats summary ──────────────────────────────────────────

def get_user_stats(user_id: str) -> dict:
    """Lightweight stats dict for the frontend sidebar."""
    profile = _load_json(_profile_path(user_id), {})
    log     = profile.get("progress_log", [])

    # Goal progress % based on weight delta toward goal_weight_kg
    progress_pct = None
    try:
        start  = float(profile.get("weight_kg", 0))
        target = float(profile.get("goal_weight_kg", 0))
        weight_entries = [e for e in log if "weight_kg" in e]
        if weight_entries and start != target and start > 0:
            current      = float(weight_entries[-1]["weight_kg"])
            progress_pct = round(
                min(100, max(0, abs(start - current) / abs(start - target) * 100)), 1
            )
    except (TypeError, ValueError, ZeroDivisionError):
        pass

    return {
        "bmi":            profile.get("bmi"),
        "bmi_label":      profile.get("bmi_label"),
        "goal":           profile.get("goal"),
        "streak_days":    profile.get("streak_days", 0),
        "last_active":    profile.get("last_active"),
        "total_log_days": profile.get("total_log_days", 0),
        "progress_pct":   progress_pct,
        "weight_kg":      profile.get("weight_kg"),
        "goal_weight_kg": profile.get("goal_weight_kg"),
        "fitness_level":  profile.get("fitness_level"),
        "workout_days":   profile.get("workout_days"),
        "diet_type":      profile.get("diet_type"),
        "recent_log":     (log[-5:][::-1]) if log else [],
    }


# ── Plans storage ──────────────────────────────────────────

def save_plan(user_id: str, plan_type: str, content: str) -> str:
    """
    Saves a generated plan (workout or meal) with a timestamp.
    plan_type: 'workout' | 'meal'
    Overwrites the previous plan of the same type.
    """
    path    = _profile_path(user_id)
    profile = _load_json(path, {})
    plans   = profile.get("plans", {})
    plans[plan_type] = {
        "content":    content,
        "created_at": _now(),
        "date":       _today(),
    }
    profile["plans"] = plans
    _save_json(path, profile)
    return f"{plan_type.title()} plan saved for {user_id}"


def get_plan(user_id: str, plan_type: str) -> dict:
    """Retrieves the most recently saved plan of the given type."""
    profile = _load_json(_profile_path(user_id), {})
    return profile.get("plans", {}).get(plan_type, {})


def get_all_plans(user_id: str) -> dict:
    """Returns both workout and meal plans for a user."""
    profile = _load_json(_profile_path(user_id), {})
    return profile.get("plans", {})


# ── ADK tool wrappers ──────────────────────────────────────

save_profile_tool    = FunctionTool(func=save_user_profile)
get_profile_tool     = FunctionTool(func=get_user_profile)
append_progress_tool = FunctionTool(func=append_progress_log)
get_log_tool         = FunctionTool(func=get_progress_log)
save_plan_tool       = FunctionTool(func=save_plan)
get_plan_tool        = FunctionTool(func=get_plan)