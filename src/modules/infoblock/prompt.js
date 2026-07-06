function formatState(state) {
  try { return JSON.stringify(state ?? null, null, 2); } catch (_) { return 'null'; }
}

export function buildPrompt({ lang = 'ru', previousState = null }) {
  const languageRule = lang === 'ru'
    ? '**LANGUAGE REQUIREMENT**: All text values (date, time, location, global_conflict, characters fields, key_detail, plot_summary, future_plot) MUST be written in Russian language.'
    : '**LANGUAGE REQUIREMENT**: All text values must be written in English language.';
  return `[System Note: Update the fictional world state and character status from the latest assistant reply.
At the VERY END of the module output, output a JSON block wrapped in <scene_state> tags with the current scene information.
Place the JSON inside an HTML comment: <scene_state><!-- { ... } --></scene_state>

Previous persistent scene state for continuity:
${formatState(previousState)}

CRITICAL: Output the JSON as a single line, without any line breaks or newlines inside the comment. This is extremely important for clean display.

${languageRule}

Text fields may use lightweight Markdown for emphasis, lists, inline code, and line breaks when it improves readability.
Do not use raw HTML in JSON text fields.
Do not put markdown outside the required hidden block.
All markdown must be inside JSON string values only.

Example: <scene_state><!-- {"date": "...", ...} --></scene_state>

{
  "date": "string, current in-world date",
  "time": "string, current time of day",
  "location": "string, specific room or area",
  "global_conflict": "string, external threats, political tensions, or environmental factors",
  "characters": [
    {
      "name": "string, character name",
      "outfit": "string, detailed current clothing",
      "position": "string, physical stance, orientation, distance from others",
      "condition": "string, physical health, injuries, fatigue, illness, or body status"
    }
  ],
  "key_detail": "string, crucial sensory or object detail to maintain",
  "plot_summary": "string, 1-2 sentence recap of what is happening right now",
  "future_plot": "string, brief note on the intended next step or goal"
}

RULES:
- Preserve continuity from previous persistent state unless the latest scene clearly changes it.
- Be specific and detailed for each field.
- Characters array: list all present characters with current outfit, physical position and health condition.
- Global conflict: persistent external factors that can intervene.
</scene_state>]`;
}