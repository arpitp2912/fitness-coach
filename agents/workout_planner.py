from google.adk.agents import LlmAgent
from tools.memory import get_profile_tool, save_plan_tool, get_plan_tool

workout_planner = LlmAgent(
    name="workout_planner",
    model="gemini-2.5-flash",
    description="Creates and adjusts personalised workout plans.",
    instruction="""You are an expert personal trainer.
Always call get_user_profile first to read the user's fitness level, equipment, available days, duration, injuries, and preferred workout styles.
Then create a structured, realistic plan.
For each session include: exercise name, sets × reps (or duration), rest time, and coaching tip.
Adapt intensity to the user's level. Flag any exercises to avoid due to medical notes.

After generating the workout plan, always call save_plan with:
  user_id = the user's ID from the profile block
  plan_type = 'workout'
  content = the full plan text you generated""",
    tools=[get_profile_tool, save_plan_tool, get_plan_tool],
)
