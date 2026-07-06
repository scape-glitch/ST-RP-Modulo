function formatState(state) {
  try { return JSON.stringify(state ?? null, null, 2); } catch (_) { return 'null'; }
}

export function buildPrompt({ lang = 'ru', previousState = null }) {
  const languageRule = lang === 'ru'
    ? '**LANGUAGE**: All text values (name, mood, thoughts, secret, insight, feeling, intention) MUST be in Russian (Cyrillic).'
    : '**LANGUAGE**: All text values (name, mood, thoughts, secret, insight, feeling, intention) MUST be in English.';
  return `[System Note: Every time the module analyzes the latest assistant reply, include statistics for the main character and ALL other characters/NPCs in the scene (except the user), wrapped in <rs_metrics> tags.
Output the JSON on a single line. Place the JSON inside an HTML comment: <rs_metrics><!-- { ... } --></rs_metrics>

Previous persistent metrics state for continuity:
${formatState(previousState)}

CRITICAL: Output the JSON as a single line, without any line breaks or newlines inside the comment.
Example: <rs_metrics><!-- {"characters": [{"name": "...", ...}, {"name": "...", ...}]} --></rs_metrics>

Text fields may use lightweight Markdown for emphasis, lists, inline code, and line breaks when it improves readability.
Do not use raw HTML in JSON text fields.
Do not put markdown outside the required hidden block.
All markdown must be inside JSON string values only.

**MANDATORY COVERAGE OF ALL CHARACTERS — NON-NEGOTIABLE**:
- The main assistant character is ALWAYS the FIRST and MANDATORY ENTRY. The first object in the "characters" array MUST ALWAYS be the main character in EVERY reply.
- After the main character, add ONE object for EVERY OTHER character/NPC (except the user) present, speaking, acting, or participating in THIS reply.
- "Present" INCLUDES characters who are remote but active this turn (parallel scene, another location, phone/video/message). Physical co-location is NOT required.
- Include named NPCs, unnamed but present NPCs (give a descriptor), background, minor, or newly introduced characters.
- Do NOT merge characters. Each distinct character = one object.
- NEVER include the user/player.
- Order: main character first, then others.

${languageRule}

**THOUGHTS — FIRST PERSON, NON-NEGOTIABLE**:
- "thoughts" MUST be the character's inner monologue in FIRST PERSON as they think it RIGHT NOW.
- Genuine thoughts, NOT third-person description. NEVER "He/she thinks...".
- Raw and natural, in the character's own voice. Up to 5 sentences.
- You MAY use *italics* or **bold** markdown sparingly for emphasis inside thoughts.

**RELATIONSHIP — BIDIRECTIONAL, PROGRESSIVE (−100 to +100)**:
- "relationship" is from −100 to +100 toward the user: −100 = hatred/disgust, 0 = neutral/indifferent, +100 = love/deep bond.
- PROGRESSIVE and CUMULATIVE: carry over from previous persistent state. Nudge by a SMALL amount (typically ±1 to ±10 per turn, more only after a major emotional event). Do NOT reset or jump wildly.
- At RP start, pick a fitting value: strangers near 0-20, hostility negative, existing bonds higher.
- "feeling" is a SHORT label (1-3 words) naming the current feeling, matching the value.

**INTENTION**:
- "intention" is a short plain-text phrase describing what the character intends/is about to do RIGHT NOW.

JSON structure:
{
  "characters": [
    {
      "name": "Character Name",
      "color": "#4a4a4a",
      "mood": "short mood + emojis/kaomojis",
      "mood_hex": "#FFD700",
      "thoughts": "First-person inner monologue up to 5 sentences.",
      "thoughts_hex": "#cccccc",
      "relationship": 35,
      "relationship_hex": "#ff99cc",
      "feeling": "short feeling label",
      "intention": "short current intention",
      "arousal": 15,
      "arousal_hex": "#ff6666",
      "grudge": 0,
      "grudge_hex": "#cc5555",
      "respect": 80,
      "respect_hex": "#99ccff",
      "secret": "Plans for the near future",
      "insight": "Short phrase about true feelings"
    }
  ]
}

RULES:
- Mood: short text + emojis/kaomojis chosen by the model.
- Thoughts: FIRST PERSON, max 5 sentences. Markdown *italic*/**bold** allowed.
- Relationship: −100 to +100, progressive; "feeling" names it.
- Intention: short plain text.
- Arousal: 0-100+ (can be negative or >100). Grudge: 0-100. Respect: 0-100 or "MAX".
- Secret: hidden by default. Insight: shown on flip.
- Use ONLY "characters" as the key. The array MUST start with the main character.
</rs_metrics>]`;
}