import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from tools.memory import (
    register_user, login_user,
    save_user_profile, get_user_profile, get_user_stats,
    save_profile_tool, get_profile_tool,
    append_progress_tool, get_log_tool,
    append_progress_log, get_progress_log,
    PROFILES_DIR,
)

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part
from agents.orchestrator import orchestrator
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

APP_NAME       = "fitness_coach"
CHAT_TIMEOUT_S = 60
session_service = InMemorySessionService()
runners: dict  = {}


async def get_runner(user_id: str):
    if user_id not in runners:
        await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=user_id
        )
        runners[user_id] = Runner(
            agent=orchestrator,
            app_name=APP_NAME,
            session_service=session_service,
        )
    return runners[user_id]


# ── Auth ───────────────────────────────────────────────────

class AuthRequest(BaseModel):
    username: str
    password: str

@app.post("/register")
async def register(req: AuthRequest):
    username = req.username.strip().lower()
    result   = register_user(username, req.password)
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"user_id": username, "is_new": True, "profile": {}, "stats": {}}

@app.post("/login")
async def login(req: AuthRequest):
    username = req.username.strip().lower()
    result   = login_user(username, req.password)
    if not result["ok"]:
        raise HTTPException(status_code=401, detail=result["error"])
    profile = get_user_profile(username)
    stats   = get_user_stats(username)
    return {
        "user_id": username,
        "is_new":  not profile.get("onboarded", False),
        "profile": profile,
        "stats":   stats,
    }


# ── Profile ────────────────────────────────────────────────

class ProfileRequest(BaseModel):
    user_id: str
    data: dict

@app.post("/profile")
async def save_profile(req: ProfileRequest):
    save_user_profile(req.user_id, req.data)
    stats = get_user_stats(req.user_id)
    return {"status": "ok", "stats": stats}

@app.get("/profile/{user_id}")
async def load_profile(user_id: str):
    return get_user_profile(user_id)


# ── Debug (remove in production) ──────────────────────────

@app.get("/debug/profile/{user_id}")
async def debug_profile(user_id: str):
    """
    Call this in your browser to verify the profile was saved.
    e.g. http://localhost:8000/debug/profile/arpit
    """
    from tools.memory import PROFILES_DIR
    path    = PROFILES_DIR / f"{user_id}.json"
    profile = get_user_profile(user_id)
    return {
        "file_path":    str(path),
        "file_exists":  path.exists(),
        "profile_keys": list(profile.keys()),
        "profile":      profile,
    }


# ── Stats ──────────────────────────────────────────────────

@app.get("/stats/{user_id}")
async def fetch_stats(user_id: str):
    return get_user_stats(user_id)


# ── Progress ───────────────────────────────────────────────

class ProgressRequest(BaseModel):
    user_id: str
    entry: dict

@app.post("/progress")
async def log_progress(req: ProgressRequest):
    result = append_progress_log(req.user_id, req.entry)
    stats  = get_user_stats(req.user_id)
    return {"status": "ok", "message": result, "stats": stats}

@app.get("/progress/{user_id}")
async def get_progress(user_id: str):
    return {"log": get_progress_log(user_id)}


# ── Plans ──────────────────────────────────────────────────

@app.get("/plan/{user_id}/{plan_type}")
async def fetch_plan(user_id: str, plan_type: str):
    """plan_type must be 'workout' or 'meal'."""
    from tools.memory import get_plan
    plan = get_plan(user_id, plan_type)
    if not plan:
        raise HTTPException(status_code=404, detail=f"No {plan_type} plan saved yet")
    return plan

@app.get("/plans/{user_id}")
async def fetch_all_plans(user_id: str):
    """Returns both workout and meal plans for a user."""
    from tools.memory import get_all_plans
    return get_all_plans(user_id)


# ── Chat ───────────────────────────────────────────────────

class ChatRequest(BaseModel):
    user_id: str
    message: str

import logging
import os

logger = logging.getLogger("forge")
logging.basicConfig(level=logging.INFO)


def _build_message(user_id: str, user_message: str) -> str:
    """
    Prepend the user's full profile so every sub-agent has context
    without needing to call get_user_profile as a tool.
    """
    profile = get_user_profile(user_id)

    # ── Debug: log profile path and content so you can verify it's found ──
    profile_file = str(PROFILES_DIR / f"{user_id}.json")
    if not profile:
        logger.warning(
            f"[FORGE] No profile found for user '{user_id}'. "
            f"Expected file: {profile_file}. "
            f"Check that onboarding completed and the file exists."
        )
        # Still send the message — but flag to the agent that profile is missing
        return (
            f"[SYSTEM: No profile found for user '{user_id}'. "
            f"Ask the user to complete onboarding before generating a plan.]\n\n"
            f"User message: {user_message}"
        )

    logger.info(f"[FORGE] Profile loaded for '{user_id}' from {profile_file} "
                f"— {len(profile)} keys")

    # Build profile block — skip internal/noisy keys
    skip = {"progress_log", "onboarded", "created_at", "bmi_label",
            "streak_days", "last_active", "total_log_days"}
    lines = [f"  user_id: {user_id}"]   # always include user_id explicitly
    for k, v in profile.items():
        profile_block = "\n".join(lines)

    return (
        f"[USER PROFILE — read this first. Use every field directly. "
        f"Do NOT ask the user to repeat any information listed here.]\n"
        f"{profile_block}\n"
        f"[END PROFILE]\n\n"
        f"User message: {user_message}"
    )


@app.post("/chat")
async def chat(req: ChatRequest):

    runner          = await get_runner(req.user_id)
    enriched_text   = _build_message(req.user_id, req.message)
    message         = Content(role="user", parts=[Part(text=enriched_text)])

    # Detect plan intent from user's original message
    msg_lower    = req.message.lower()
    is_workout   = any(w in msg_lower for w in ["workout", "training", "exercise", "routine"])
    is_meal      = any(w in msg_lower for w in ["meal", "diet", "eat", "food", "nutrition", "macros"])

    async def stream_reply():
        full_reply = ""
        try:
            async with asyncio.timeout(CHAT_TIMEOUT_S):
                async for event in runner.run_async(
                    user_id=req.user_id,
                    session_id=req.user_id,
                    new_message=message,
                ):
                    if event.is_final_response() and event.content:
                        for part in event.content.parts:
                            if part.text:
                                full_reply += part.text
                                yield part.text
        except asyncio.TimeoutError:
            yield "\n\n_Your coach took too long to respond. Please try again._"
            return

        # Auto-save the generated plan if relevant
        from tools.memory import save_plan
        if is_workout and len(full_reply) > 100:
            save_plan(req.user_id, "workout", full_reply)
            logger.info(f"[FORGE] Auto-saved workout plan for '{req.user_id}'")
        elif is_meal and len(full_reply) > 100:
            save_plan(req.user_id, "meal", full_reply)
            logger.info(f"[FORGE] Auto-saved meal plan for '{req.user_id}'")

    return StreamingResponse(stream_reply(), media_type="text/plain")