import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

const API = "http://localhost:8000";

const STEPS = [
  { key: "age",               label: "How old are you?",                     type: "number", unit: "yrs", placeholder: "e.g. 28" },
  { key: "gender",            label: "What is your gender?",                 type: "choice", options: ["Male", "Female", "Non-binary", "Prefer not to say"] },
  { key: "height_cm",         label: "Your height?",                         type: "number", unit: "cm",  placeholder: "e.g. 175" },
  { key: "weight_kg",         label: "Current weight?",                      type: "number", unit: "kg",  placeholder: "e.g. 78" },
  { key: "goal",              label: "Primary goal?",                         type: "choice", options: ["Lose weight", "Build muscle", "Improve endurance", "Increase flexibility", "General wellness"] },
  { key: "goal_weight_kg",    label: "Target weight?",                        type: "number", unit: "kg",  placeholder: "e.g. 70", optional: true },
  { key: "timeframe",         label: "Goal timeframe?",                       type: "choice", options: ["1 month", "3 months", "6 months", "1 year", "No deadline"] },
  { key: "fitness_level",     label: "Current fitness level?",                type: "choice", options: ["Complete beginner", "Some experience", "Intermediate", "Advanced athlete"] },
  { key: "activity_level",    label: "Daily activity outside workouts?",      type: "choice", options: ["Sedentary", "Lightly active", "Moderately active", "Very active"] },
  { key: "workout_days",      label: "Training days per week?",               type: "choice", options: ["1–2 days", "3–4 days", "5–6 days", "Every day"] },
  { key: "workout_duration",  label: "Session length?",                       type: "choice", options: ["15–20 min", "30–45 min", "45–60 min", "60–90 min", "90+ min"] },
  { key: "equipment",         label: "Equipment access?",                     type: "choice", options: ["No equipment", "Bands / dumbbells", "Full home gym", "Commercial gym"] },
  { key: "preferred_workouts",label: "Workout styles you enjoy?",             type: "multi",  options: ["Cardio", "Strength", "HIIT", "Yoga / Pilates", "Sports", "Outdoor"] },
  { key: "diet_type",         label: "Diet preference?",                      type: "choice", options: ["No preference", "Vegetarian", "Vegan", "Keto", "Intermittent fasting", "Paleo"] },
  { key: "meals_per_day",     label: "Meals per day?",                        type: "choice", options: ["1–2", "3", "4–5", "6+"] },
  { key: "allergies",         label: "Food allergies or intolerances?",       type: "text",   placeholder: "e.g. dairy, gluten — or none", optional: true },
  { key: "water_intake",      label: "Daily water intake?",                   type: "choice", options: ["< 1L", "1–2L", "2–3L", "3L+"] },
  { key: "sleep_hours",       label: "Average sleep?",                        type: "choice", options: ["< 5h", "5–6h", "6–7h", "7–8h", "8h+"] },
  { key: "stress_level",      label: "Daily stress level?",                   type: "choice", options: ["Low", "Moderate", "High", "Very high"] },
  { key: "medical_notes",     label: "Injuries or health conditions?",        type: "text",   placeholder: "e.g. lower back pain — or none", optional: true },
];

const QUICK = [
  { icon: "▶", label: "Today's workout",  msg: "Give me today's full workout plan" },
  { icon: "◉", label: "Meal plan",        msg: "What should I eat today?" },
  { icon: "↑", label: "Log progress",     msg: "I want to log my progress" },
  { icon: "◆", label: "Motivate me",      msg: "I need some motivation right now" },
  { icon: "?", label: "Explain my plan",  msg: "Explain my current training plan" },
  { icon: "~", label: "Adjust intensity", msg: "Adjust my workout intensity" },
];

function calcBMI(w, h) {
  if (!w || !h) return null;
  return (parseFloat(w) / (parseFloat(h) / 100) ** 2).toFixed(1);
}
function bmiMeta(b) {
  const n = parseFloat(b);
  if (n < 18.5) return { label: "Underweight", color: "#60a5fa" };
  if (n < 25)   return { label: "Healthy",     color: "#c8ff00" };
  if (n < 30)   return { label: "Overweight",  color: "#facc15" };
  return              { label: "Obese",         color: "#f87171" };
}

function renderText(text) {
  return text.split("\n").map((line, i, arr) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <span key={i}>
        {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

// ══════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════
function AuthScreen({ onAuth }) {
  const [mode, setMode]   = useState("login");
  const [user, setUser]   = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const [busy, setBusy]   = useState(false);

  async function submit() {
    if (!user.trim() || !pass.trim()) return;
    setErr(""); setBusy(true);
    try {
      const res  = await fetch(`${API}/${mode === "login" ? "login" : "register"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.trim(), password: pass }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.detail || "Error"); setBusy(false); return; }
      onAuth(data);
    } catch {
      setErr("Cannot reach server. Is the backend running?");
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-glow" />
      <div className="auth-card fade-up">
        <div className="brand">
          <span className="brand-tri">▲</span>
          <span className="brand-name">FORGE</span>
          <span className="brand-coach">coach</span>
        </div>
        <p className="brand-sub">AI-powered personal fitness &amp; nutrition</p>

        <div className="auth-tabs">
          {["login","register"].map(m => (
            <button key={m} className={`auth-tab ${mode===m?"active":""}`}
              onClick={() => { setMode(m); setErr(""); }}>
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <div className="form-stack">
          <div className="form-field">
            <label className="form-label">Username</label>
            <input className="form-input" value={user} onChange={e=>setUser(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="your_username" autoFocus />
          </div>
          <div className="form-field">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={pass}
              onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
              placeholder="••••••••" />
          </div>
          {err && <div className="form-error">{err}</div>}
          <button className="cta" onClick={submit} disabled={busy||!user.trim()||!pass.trim()}>
            {busy ? <span className="dot-spin" /> : mode==="login" ? "Sign in →" : "Create account →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════════════════════════
function Onboarding({ userId, onDone }) {
  const [step, setStep]       = useState(0);
  const [answers, setAnswers] = useState({});
  const [input, setInput]     = useState("");
  const [multi, setMulti]     = useState([]);
  const [saving, setSaving]   = useState(false);

  const cur  = STEPS[step];
  const pct  = (step / STEPS.length) * 100;
  const bmi  = calcBMI(answers.weight_kg, answers.height_cm);
  const bmim = bmi ? bmiMeta(bmi) : null;

  function advance(val) {
    const next = { ...answers, [cur.key]: val };
    setAnswers(next); setInput(""); setMulti([]);
    if (step < STEPS.length - 1) setStep(s => s+1);
    else finish(next);
  }

  async function finish(data) {
    setSaving(true);
    const b = calcBMI(data.weight_kg, data.height_cm);
    const enriched = { ...data, bmi: b, bmi_label: b ? bmiMeta(b).label : "N/A", onboarded: true };
    const res = await fetch(`${API}/profile`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, data: enriched }),
    });
    const json = await res.json();
    setSaving(false);
    onDone(enriched, json.stats || {});
  }

  return (
    <div className="onboard-screen">
      <div className="onboard-card fade-up">
        <div className="ob-topbar">
          <div className="ob-track"><div className="ob-fill" style={{width:`${pct}%`}} /></div>
          <span className="ob-counter">{step+1} / {STEPS.length}</span>
        </div>

        {bmim && (
          <div className="bmi-tag" style={{borderColor:bmim.color,color:bmim.color}}>
            BMI {bmi} · {bmim.label}
          </div>
        )}

        <h2 className="ob-q">{cur.label}</h2>
        {cur.optional && <p className="ob-opt">Optional — skip if not applicable</p>}

        {cur.type === "choice" && (
          <div className="ob-choices">
            {cur.options.map(o => (
              <button key={o} className="ob-choice" onClick={()=>advance(o)}>{o}</button>
            ))}
            {cur.optional && <button className="ob-choice skip" onClick={()=>advance("N/A")}>Skip</button>}
          </div>
        )}

        {cur.type === "multi" && (
          <>
            <div className="ob-choices">
              {cur.options.map(o => (
                <button key={o} className={`ob-choice ${multi.includes(o)?"sel":""}`}
                  onClick={()=>setMulti(p=>p.includes(o)?p.filter(x=>x!==o):[...p,o])}>
                  {o}
                </button>
              ))}
            </div>
            <button className="cta" style={{marginTop:14}} disabled={multi.length===0}
              onClick={()=>advance(multi.join(", "))}>Confirm selection →</button>
          </>
        )}

        {(cur.type==="number"||cur.type==="text") && (
          <div className="ob-input-block">
            <div className="ob-input-row">
              <input className="form-input" type={cur.type==="number"?"number":"text"}
                value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&(input.trim()?advance(input.trim()):cur.optional&&advance("N/A"))}
                placeholder={cur.placeholder} autoFocus />
              {cur.unit && <span className="input-unit">{cur.unit}</span>}
            </div>
            <button className="cta" disabled={!input.trim()&&!cur.optional}
              onClick={()=>advance(input.trim()||"N/A")}>
              {step < STEPS.length-1 ? "Next →" : "Finish →"}
            </button>
            {cur.optional && <button className="ghost" onClick={()=>advance("N/A")}>Skip</button>}
          </div>
        )}

        {saving && <p className="saving">Calibrating your programme…</p>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// CHAT — OBSIDIAN ATHLETE
// ══════════════════════════════════════════════════════════
function ChatScreen({ userId, profile, stats: initStats, onLogout }) {
  const [msgs, setMsgs]       = useState([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats]     = useState(initStats || {});
  const [open, setOpen]       = useState(true);
  const bottomRef             = useRef(null);
  const inputRef              = useRef(null);
  const greeted               = useRef(false);

  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    const s = stats.streak_days || 0;
    const streakLine = s > 0 ? ` You're on a **${s}-day streak**.` : "";
    setMsgs([{
      role: "coach",
      text: `Welcome back, ${userId}.${streakLine}\n\nWhat are we working on today?`,
      ts: Date.now(),
    }]);
  }, [userId, stats]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  async function refreshStats() {
    try { const r = await fetch(`${API}/stats/${userId}`); setStats(await r.json()); }
    catch {}
  }

  const send = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setMsgs(p => [...p, { role: "user", text: msg, ts: Date.now() }]);
    setLoading(true);
    try {
      const res     = await fetch(`${API}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, message: msg }),
      });
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let reply     = "";
      setMsgs(p => [...p, { role: "coach", text: "", ts: Date.now(), streaming: true }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMsgs(p => [...p.slice(0,-1), { role: "coach", text: reply, ts: Date.now(), streaming: true }]);
      }
      setMsgs(p => [...p.slice(0,-1), { role: "coach", text: reply, ts: Date.now() }]);
      await refreshStats();
    } catch {
      setMsgs(p => [...p.filter(m=>!m.streaming), { role:"coach", text:"Connection error. Check backend.", ts:Date.now() }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  }, [input, loading, userId]);

  const statRows = [
    { k: "Goal",     v: stats.goal           || profile?.goal },
    { k: "Weight",   v: stats.weight_kg      ? `${stats.weight_kg} kg` : null },
    { k: "BMI",      v: stats.bmi            ? `${stats.bmi} · ${stats.bmi_label}` : null },
    { k: "Level",    v: stats.fitness_level  || profile?.fitness_level },
    { k: "Days/wk",  v: stats.workout_days   || profile?.workout_days },
    { k: "Diet",     v: stats.diet_type      || profile?.diet_type },
  ].filter(s => s.v);

  return (
    <div className="chat-layout">
      <aside className={`sidebar ${open?"":"collapsed"}`}>
        <div className="sidebar-body">
          <div className="sb-brand">
            <span className="sb-tri">▲</span>
            <span className="sb-name">FORGE</span>
            <span className="sb-tag">coach</span>
          </div>

          <div className="sb-user">
            <div className="sb-avatar">{userId[0].toUpperCase()}</div>
            <div>
              <div className="sb-uname">{userId}</div>
              <div className="sb-ugoal">{stats.goal || profile?.goal || "—"}</div>
            </div>
          </div>

          <div className="sb-counters">
            <div className="sb-counter">
              <div className="sc-val">{stats.streak_days || 0}</div>
              <div className="sc-lbl">day streak</div>
            </div>
            <div className="sc-divider" />
            <div className="sb-counter">
              <div className="sc-val">{stats.total_log_days || 0}</div>
              <div className="sc-lbl">days logged</div>
            </div>
          </div>

          {stats.progress_pct != null && (
            <div className="sb-progress">
              <div className="sb-prog-header">
                <span>Goal progress</span>
                <span>{stats.progress_pct}%</span>
              </div>
              <div className="sb-prog-track">
                <div className="sb-prog-fill" style={{width:`${stats.progress_pct}%`}} />
              </div>
            </div>
          )}

          <div className="sb-stats">
            {statRows.map(s => (
              <div key={s.k} className="sb-stat">
                <span className="sb-stat-k">{s.k}</span>
                <span className="sb-stat-v">{s.v}</span>
              </div>
            ))}
          </div>

          <div className="sb-quick">
            <div className="sb-section-lbl">Quick actions</div>
            {QUICK.map(q => (
              <button key={q.label} className="sb-qbtn" onClick={()=>send(q.msg)}>
                <span className="sq-icon">{q.icon}</span>{q.label}
              </button>
            ))}
          </div>

          <button className="sb-logout" onClick={onLogout}>← Sign out</button>
        </div>
      </aside>

      <div className="main">
        <header className="main-header">
          <button className="toggle" onClick={()=>setOpen(o=>!o)}>{open?"◀":"▶"}</button>
          <div className="mh-center">
            <span className="mh-title">Your Coach</span>
            <span className="mh-live"><span className="live-dot" />Online · AI-powered</span>
          </div>
        </header>

        <div className="msgs-area">
          {msgs.map((m,i) => (
            <div key={i} className={`msg ${m.role} fade-up`}>
              {m.role==="coach" && <div className="ci">▲</div>}
              <div className={`bubble ${m.streaming?"streaming":""}`}>
                {m.text
                  ? renderText(m.text)
                  : <span className="dots"><span/><span/><span/></span>
                }
              </div>
              {m.role==="user" && <div className="ui">{userId[0].toUpperCase()}</div>}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="input-bar">
          <div className="input-shell">
            <textarea ref={inputRef} className="chat-ta" rows={1}
              value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              placeholder="Ask your coach — workout, nutrition, progress, doubts…"
              disabled={loading} />
            <button className="send" onClick={()=>send()} disabled={loading||!input.trim()}>↑</button>
          </div>
          <p className="input-hint">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [screen,  setScreen]  = useState("auth");
  const [userId,  setUserId]  = useState(null);
  const [profile, setProfile] = useState(null);
  const [stats,   setStats]   = useState({});

  function handleAuth({ user_id, is_new, profile: p, stats: s }) {
    setUserId(user_id); setProfile(p||{}); setStats(s||{});
    setScreen(is_new ? "onboard" : "chat");
  }
  function handleOnboardDone(p, s) { setProfile(p); setStats(s||{}); setScreen("chat"); }
  function handleLogout() { setUserId(null); setProfile(null); setStats({}); setScreen("auth"); }

  if (screen==="auth")    return <AuthScreen onAuth={handleAuth} />;
  if (screen==="onboard") return <Onboarding userId={userId} onDone={handleOnboardDone} />;
  return <ChatScreen userId={userId} profile={profile} stats={stats} onLogout={handleLogout} />;
}
