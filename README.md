# FORGE Coach — AI-Powered Fitness & Nutrition System

A multi-agent personal fitness and nutrition coaching app built on Google's Agent Development Kit (ADK), with a React frontend and FastAPI backend.

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│  React Frontend │ ───► │ FastAPI Backend  │ ───► │ ADK Multi-Agent     │
│  (Obsidian UI)  │ ◄─── │ (auth + chat)    │ ◄─── │ System (Gemini)     │
└─────────────────┘      └──────────────────┘      └─────────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ JSON file store  │
                         │ (per-user files) │
                         └──────────────────┘
```

---

## Table of contents

1. [What this app does](#what-this-app-does)
2. [Project structure](#project-structure)
3. [The multi-agent system](#the-multi-agent-system)
4. [The three user flows](#the-three-user-flows)
5. [Backend features](#backend-features)
6. [Frontend features](#frontend-features)
7. [Memory & data storage](#memory--data-storage)
8. [API reference](#api-reference)
9. [Setup & running](#setup--running)
10. [Troubleshooting](#troubleshooting)

---

## What this app does

FORGE Coach is a personal AI fitness coach that:

- **Onboards** new users with a 20-question health and lifestyle profile
- **Calculates** BMI live during onboarding
- **Stores** user profiles, progress, and streaks persistently
- **Generates** personalised workout plans based on the user's goal, fitness level, equipment, and schedule
- **Designs** meal plans aligned with the user's diet, allergies, and calorie targets
- **Tracks** progress over time, identifying trends and milestones
- **Motivates** users through mindset coaching when they're struggling
- **Answers** follow-up questions about any generated plan

Every interaction is powered by a coordinated team of specialist AI agents that route the user's message to the right expert and synthesise unified responses.

---

## Project structure

```
fitness_coach/
├── api/
│   └── main.py               FastAPI app — endpoints + agent runner
├── agents/
│   └── all_agents.py         All 5 agents (split into files in production)
│       ├── orchestrator       routes messages to specialists
│       ├── workout_planner    creates training plans
│       ├── nutritionist       designs meal plans
│       ├── progress_tracker   logs entries, surfaces trends
│       └── motivational_coach mindset support
├── tools/
│   └── memory.py             Auth, profile, progress storage + ADK tools
├── data/                     Auto-created on first run
│   ├── users.json            hashed credentials
│   └── profiles/
│       └── {username}.json   per-user profile + log
├── frontend/
│   ├── public/
│   │   └── index.html        dark-themed root HTML
│   └── src/
│       ├── index.js          React entry point
│       ├── index.css         global reset
│       ├── App.jsx           three-screen app (auth → onboarding → chat)
│       └── App.css           Obsidian Athlete theme
├── .env                      GOOGLE_API_KEY here
└── README.md                 you are here
```

---

## The multi-agent system

The app uses **5 ADK agents** in a hub-and-spoke architecture:

```
                    ┌───────────────────────┐
                    │     Orchestrator      │  ← top-level entry point
                    │  (routes messages)    │
                    └──────────┬────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │              │       │       │              │
        ▼              ▼       ▼       ▼              ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐
   │ Workout │  │Nutrition │  │ Progress │  │ Motivational   │
   │ Planner │  │   ist    │  │ Tracker  │  │    Coach       │
   └─────────┘  └──────────┘  └──────────┘  └────────────────┘
```

### Orchestrator
- **Role:** Reads incoming messages, decides which agent(s) to call, synthesises responses
- **Routing logic** (defined in its instruction prompt):
  - Workout questions → `workout_planner`
  - Food / diet questions → `nutritionist`
  - Progress updates → `progress_tracker`
  - Motivation / mindset → `motivational_coach`
  - Daily check-in → calls all four, synthesises unified plan
- **Tools available:** `get_user_profile`, `save_user_profile`, `append_progress_log`, `get_progress_log`
- **Sub-agents:** all four specialists (ADK auto-exposes them as callable tools)

### Workout Planner
- **Role:** Creates structured, realistic workout plans
- **Output includes:** exercise name, sets × reps, rest time, coaching tips, substitutes for injuries
- **Adapts to:** fitness level, available equipment, session duration, training days, injuries
- **Uses profile fields:** `fitness_level`, `equipment`, `workout_days`, `workout_duration`, `preferred_workouts`, `medical_notes`

### Nutritionist
- **Role:** Designs meal plans and macro targets
- **Output includes:** daily calories, macro split (protein/carbs/fat), full-day meal plan with portions, hydration target, pre/post workout nutrition
- **Respects strictly:** dietary restrictions, allergies, diet type (vegan, keto, etc.)
- **Uses profile fields:** `goal`, `weight_kg`, `height_cm`, `diet_type`, `allergies`, `meals_per_day`, `water_intake`

### Progress Tracker
- **Role:** Logs progress entries and surfaces trends
- **What it does on each update:**
  1. Calls `append_progress_log` to record the entry
  2. Calls `get_progress_log` to retrieve history
  3. Identifies trends — improvements, plateaus, regressions
  4. Celebrates milestones
  5. Suggests one concrete adjustment if a plateau is detected

### Motivational Coach
- **Role:** Mindset support, validation, accountability
- **Style:** Direct, human, specific — no generic filler
- **Behaviour:** Validates first when user struggles, then redirects with energy
- **Output length:** Capped at 3–5 sentences

---

## The three user flows

### 1. New user flow (first visit)

```
User opens app
    │
    ▼
[Auth screen] → clicks "Create account" → enters username + password
    │
    ▼
POST /register → backend hashes password, creates entry in users.json
    │
    ▼
[Onboarding] → 20 questions, BMI calculated live as height/weight entered
    │
    ▼
POST /profile → backend writes data/profiles/{username}.json
    │
    ▼
[Chat] → coach greets user, ready for first question
```

### 2. Returning user flow

```
User opens app
    │
    ▼
[Auth screen] → enters username + password → clicks "Sign in"
    │
    ▼
POST /login → backend verifies hash, returns profile + stats
    │
    ▼
[Chat] → coach greets with streak info, sidebar shows full profile
```

### 3. Daily interaction flow

```
User types message in chat
    │
    ▼
POST /chat → backend prepends full profile to message
    │
    ▼
Orchestrator agent decides routing based on message content
    │
    ▼
Specialist agent(s) generate response (streamed token-by-token)
    │
    ▼
Frontend renders streaming text live
    │
    ▼
Backend refreshes /stats automatically — sidebar updates streak, progress %
```

---

## Backend features

### Authentication
- Username + password registration and login
- Passwords stored as SHA-256 hashes (never plaintext)
- `last_login` timestamp updated on every successful login

### Profile management
- 20-field user profile stored per user as JSON
- Includes: demographics, fitness goals, training schedule, equipment, diet, lifestyle, medical notes
- Profile is **injected into every chat message** so agents never have to fetch it via tool calls
- Missing profile triggers a warning log so you can debug onboarding failures

### Chat with streaming
- Streams agent responses token-by-token using `StreamingResponse`
- 60-second timeout protection — long Gemini calls don't hang the connection
- Profile context auto-prepended to every message
- Falls back to dev-mode echo if `google-adk` is not installed

### Progress tracking
- `append_progress_log` records timestamped entries with arbitrary fields
- **Streak calculation** — automatically counts consecutive days with at least one log entry
- `total_log_days` — total number of unique days with activity
- `last_active` — most recent activity date

### Stats endpoint
A lightweight `/stats/{user_id}` returns the sidebar data:
- BMI and category
- Goal
- Streak days
- Total logged days
- Goal progress % (computed from weight delta toward `goal_weight_kg`)
- Recent log entries (last 5)

### Debug endpoint
`/debug/profile/{user_id}` returns the exact file path, whether it exists, and the full profile — useful for diagnosing missing-data issues.

---

## Frontend features

### Three screens

**1. Auth screen**
- Tabbed sign-in / create-account UI
- Lime accent (`#c8ff00`) on dark background (`#080909`)
- Grid texture overlay for visual depth
- Inline error messages
- Loading spinner during submission

**2. Onboarding (20 questions)**
- Progress bar showing completion
- BMI tag updates live the moment height + weight are entered
- BMI color changes based on category (blue/lime/yellow/red)
- Three input types: `choice` (buttons), `multi` (multi-select), `number`/`text` (input fields)
- Optional questions have a "Skip" button
- Last step saves to backend and transitions to chat

**3. Chat (Obsidian Athlete theme)**
- **Sidebar** (collapsible):
  - Brand logo
  - User avatar + name + goal
  - Streak counters: day streak + days logged
  - Goal progress bar (shown only if user set a target weight)
  - Stat rows: weight, BMI, fitness level, training days, diet
  - 6 quick-action buttons (Today's workout, Meal plan, Log progress, Motivate me, Explain my plan, Adjust intensity)
  - Sign out button
- **Main chat area:**
  - Header with live status dot
  - Streaming message bubbles (token-by-token typing effect)
  - Markdown bold (`**text**`) rendered in coach responses
  - Auto-scroll to latest message
  - Coach avatar (▲) and user avatar (initial)
- **Input bar:**
  - Multi-line textarea (auto-expands)
  - Enter to send, Shift+Enter for new line
  - Send button (↑) disabled when input is empty

### Visual design
- **Font:** Bebas Neue (headings, brand), DM Sans (body)
- **Background:** Near-black `#080909` for low eye strain during long sessions
- **Accent:** Lime `#c8ff00` for actionable elements and progress indicators
- **Animations:** Fade-up entry, smooth progress bar transitions, pulsing live dot, bouncing typing dots

---

## Memory & data storage

### File layout

```
data/
├── users.json              shared file with hashed credentials for all users
└── profiles/
    ├── alice.json          alice's full profile + progress log
    └── bob.json
```

### `users.json` schema

```json
{
  "alice": {
    "password_hash": "e3b0c44298fc1c149...",
    "created_at": "2026-04-14T09:00:00",
    "last_login": "2026-04-14T18:30:00"
  }
}
```

### `profiles/{username}.json` schema

```json
{
  "age": "28",
  "gender": "Male",
  "height_cm": "175",
  "weight_kg": "78",
  "goal": "Build muscle",
  "goal_weight_kg": "82",
  "timeframe": "6 months",
  "fitness_level": "Intermediate",
  "activity_level": "Moderately active",
  "workout_days": "3–4 days",
  "workout_duration": "45–60 min",
  "equipment": "Full home gym",
  "preferred_workouts": "Strength, HIIT",
  "diet_type": "No preference",
  "meals_per_day": "3",
  "allergies": "none",
  "water_intake": "2–3L",
  "sleep_hours": "7–8h",
  "stress_level": "Moderate",
  "medical_notes": "none",
  "bmi": "25.5",
  "bmi_label": "Overweight",
  "onboarded": true,
  "streak_days": 3,
  "last_active": "2026-04-14",
  "total_log_days": 5,
  "progress_log": [
    {
      "timestamp": "2026-04-14T09:00:00",
      "date": "2026-04-14",
      "weight_kg": "77.5",
      "workout_completed": true,
      "energy_level": "high"
    }
  ]
}
```

### Why per-user files
- Reads and writes for one user never touch another user's data
- No risk of corrupting all users in one bad write
- Trivial to back up, inspect, or delete individual users
- Easy migration path to a real database (each file → one row)

### Robustness improvements
- **Absolute paths** anchored to `memory.py`'s location — works regardless of which directory uvicorn launches from
- **Auto-creation** — `data/` and `data/profiles/` are created on first write via `mkdir(parents=True, exist_ok=True)`
- **Logging** — warns when a profile is expected but not found

---

## API reference

### Auth

```
POST /register
  body: { username, password }
  returns: { user_id, is_new: true, profile: {}, stats: {} }
  errors: 400 if username taken

POST /login
  body: { username, password }
  returns: { user_id, is_new, profile, stats }
  errors: 401 if invalid credentials
```

### Profile

```
POST /profile
  body: { user_id, data }
  returns: { status: "ok", stats }

GET /profile/{user_id}
  returns: full profile dict
```

### Stats

```
GET /stats/{user_id}
  returns: {
    bmi, bmi_label, goal,
    streak_days, last_active, total_log_days,
    progress_pct, weight_kg, goal_weight_kg,
    fitness_level, workout_days, diet_type,
    recent_log: [...]
  }
```

### Progress

```
POST /progress
  body: { user_id, entry: { weight_kg?, workout_completed?, ... } }
  returns: { status: "ok", message, stats }

GET /progress/{user_id}
  returns: { log: [...] }
```

### Chat

```
POST /chat
  body: { user_id, message }
  returns: StreamingResponse — plain text chunks streamed token-by-token
```

### Debug

```
GET /debug/profile/{user_id}
  returns: { file_path, file_exists, profile_keys, profile }
```

---

## Setup & running

### Backend

```bash
# Install dependencies
pip install fastapi uvicorn google-adk google-genai python-dotenv

# Create .env at fitness_coach/ root
echo "GOOGLE_API_KEY=your_gemini_api_key" > .env

# Start the backend
uvicorn api.main:app --reload --port 8000
```

Backend runs at **http://localhost:8000**.

### Frontend

```bash
# In a new terminal, from fitness_coach/
npx create-react-app frontend
cd frontend

# Replace the auto-generated files with the ones from this repo:
#   public/index.html
#   src/index.js
#   src/index.css
#   src/App.jsx          (delete src/App.js)
#   src/App.css

# Start the dev server
npm start
```

Frontend runs at **http://localhost:3000**.

### First-time flow

1. Open http://localhost:3000
2. Click **Create account**, enter a username + password
3. Complete the 20-question onboarding
4. Chat with your coach
5. Next visit → **Sign in** → go straight to chat with full context preserved

---

## Troubleshooting

### "Agent says it doesn't have my details"
Verify the profile was actually saved:
```
GET http://localhost:8000/debug/profile/{your_username}
```
- If `file_exists: false` — onboarding never reached the backend. Check the frontend network tab.
- If `file_exists: true` but `profile_keys` is short — the React app didn't send all the answers.
- If the path looks wrong — you're running uvicorn from a different directory. The absolute-path fix in `memory.py` should prevent this.

### "Cannot reach server"
The frontend can't reach `http://localhost:8000`. Check:
- Backend is actually running (`uvicorn` terminal should show "Application startup complete")
- CORS is configured (already done in `main.py`)
- No other service is using port 8000

### "Coach took too long to respond"
The 60-second timeout fired. Either:
- Your Gemini API key is invalid or rate-limited (check the backend terminal)
- The agent is doing too many sub-agent calls — simplify the orchestrator instruction
- Increase `CHAT_TIMEOUT_S` in `api/main.py`

### "White background instead of dark UI"
Three files must be in place:
- `public/index.html` (sets background on html/body/#root before React loads)
- `src/index.css` (global reset)
- `src/index.js` (imports `index.css` before `App.css`)

### "ADK not installed" warning in chat
The backend will run in dev-mode echo until you install:
```bash
pip install google-adk google-genai
```
And set `GOOGLE_API_KEY` in your `.env`.

---

## What's next

Suggested improvements to take this further:

- **Plan storage** — save generated workouts/meals to user's JSON for retrieval
- **Plan validation** — Pydantic schemas + retry loop for invalid JSON output from agents
- **Pre-computed context** — TDEE, macro targets, intensity guides injected into agent context
- **Database migration** — swap JSON files for Redis or SQLite (drop-in replacement)
- **JWT auth** — replace plain username trust with signed tokens
- **Scheduled check-ins** — APScheduler for proactive daily prompts
- **Progress charts** — Recharts visualisations of weight trends and workout completion
- **Workout logger UI** — structured form for ticking off planned exercises

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 |
| Frontend styling | Vanilla CSS with custom design tokens |
| Frontend fonts | Bebas Neue + DM Sans (Google Fonts) |
| Backend framework | FastAPI |
| Backend runtime | Uvicorn (ASGI) |
| Agent framework | Google ADK (Agent Development Kit) |
| LLM | Gemini 2.5 Flash (recommended) or 2.0 Flash |
| Storage | JSON files (per-user) |
| Auth | SHA-256 password hashing |
| Streaming | Server-Sent text via FastAPI `StreamingResponse` |

---

## License

This is a learning / demo project. Customise freely for your own use.