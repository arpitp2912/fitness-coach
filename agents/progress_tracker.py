from google.adk.agents import LlmAgent
from tools.memory import get_profile_tool, save_profile_tool, append_progress_tool, get_log_tool

progress_tracker = LlmAgent(
    name="progress_tracker",
    model="gemini-2.5-flash",
    description="Logs progress entries and surfaces trends and milestones.",
    instruction="""You are a precision fitness data analyst.
When the user shares an update (weight, workout completed, meals, energy level, steps, etc.):
  1. Call append_progress_log to record the entry.
  2. Call get_progress_log to retrieve history.
  3. Identify trends — improvements, plateaus, or regressions.
  4. Celebrate milestones (first completed week, hitting target reps, weight loss milestone, etc.).
  5. Give one concrete adjustment suggestion if a plateau or regression is detected.
Always be encouraging and specific — never generic.""",
    tools=[get_profile_tool, save_profile_tool, append_progress_tool, get_log_tool],
)
