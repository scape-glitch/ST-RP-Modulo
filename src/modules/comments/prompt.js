function formatState(state) {
  try { return JSON.stringify(state ?? null, null, 2); } catch (_) { return 'null'; }
}

export function buildPrompt({ lang = 'ru', previousState = null }) {
  const languageRule = lang === 'ru'
    ? 'Comment field MUST be Russian (English meme phrases mixed in are fine). display_name must be Russian/Cyrillic; username must be lowercase Latin.'
    : 'Comment field MUST be English with natural internet slang. display_name and username should be distinct.';
  const author = previousState?.author;
  const recent = Array.isArray(previousState?.recentAuthorReplies) ? previousState.recentAuthorReplies.slice(-8) : [];
  const authorBlock = author && recent.length
    ? `\n\n**THE AUTHOR (OP) HAS RECENTLY REPLIED IN THE COMMENTS — DIVERSE REACTIONS REQUIRED**:\nThe official Author account "${author.name || 'Author'}" has left ${recent.length} new replies. Some fans will lose their minds with joy, but others WILL argue, disagree, mock, or insult the author. Haters MUST NOT turn into bootlickers just because the author replied.\nRecent author replies:\n${recent.map((r, i) => `Author reply ${i + 1}: "${String(r.text || '').slice(0, 220)}"${r.parentText ? ` (replying to @${r.parentUser || '???'}: "${String(r.parentText).slice(0, 120)}")` : ''}`).join('\n')}\n\nMANDATORY DIVERSITY OF REACTIONS TO THE AUTHOR:\n- At least 2-3 commenters must react to one or more author replies. Do NOT make them all positive. At least ONE reaction MUST be negative.\n- The persons the author replied to may respond again, joyfully, defensively, angrily, or doubling down.\n- Haters who were already complaining MUST NOT suddenly praise the author.\n- General commenters can also ignore the author entirely.\n\n**FORBIDDEN — IMPERSONATION**: The display_name "${author.name || 'Author'}" is RESERVED for the real author account ONLY. Do NOT output any comment using that display_name/handle or claiming to be the author.`
    : (author ? `\n\n**FORBIDDEN — IMPERSONATION**: The display_name "${author.name || 'Author'}" is RESERVED for the real author account ONLY. NEVER create a commenter using that name/handle or claiming to be the author/OP/creator. Commenters are fans, never the author.` : '');
  return `[System Note: Generate a fictional Twitter/X comment section reacting to the NEWEST events in the latest roleplay context. Output ONLY valid JSON inside <social_comments> tags at the END of your response.
Place the JSON inside an HTML comment: <social_comments><!-- { ... } --></social_comments>

Previous persistent comments state (likes/replies/author/recentAuthorReplies):
${formatState(previousState)}

CRITICAL: Output the JSON as a SINGLE line, no line breaks inside the comment.
Example: <social_comments><!-- {"comments": [...]} --></social_comments>

Text fields may use lightweight Markdown for emphasis, lists, inline code, and line breaks when it improves readability.
Do not use raw HTML in JSON text fields.
Do not put markdown outside the required hidden block.
All markdown must be inside JSON string values only.

**HOW MANY**: Produce 8 to 11 commenters. Lean toward MORE (10-11) when events are dramatic or there is a big argument thread; fewer (8) when quiet. Never a fixed quota.

**THE GOLDEN RULE — REAL CHAOTIC HUMANS, NOT A TEMPLATE**:
This must read like a REAL, messy, alive comment section, not clones of one person. Every commenter is a DISTINCT human with their own writing voice. Vary EVERYTHING:
- Style: some ALL CAPS, some all-lowercase-no-punctuation, some typos/wdym/teh, some one cryptic word, some ramble, some weirdly formal, some spam emojis, some zero emojis, some keyboard-smash, some use 💀😭 instead of laughing.
- Length: mix very short with medium. Never all the same.
- Tone: genuinely-positive, unhinged-stan, bored/indifferent, joking, deranged theorist, casual lurker, AND aggressive haters.
- Personas: obsessed stan, bitter hater, delusional shipper, galaxy-brain theorist, "I can fix them" type, deadpan ironic poster, TMI oversharer, fandom grandpa, troll, confused normie, niche inside-joker.

**HATERS & DRAMA (mandatory, FUN not monotone)**:
- At least 2 genuinely aggressive haters. If RP is fluffy, they STILL attack.
- Haters must NOT sound the same: one loud-caps-rage, one coldly condescending, one passive-aggressive concern-troll.

**THREADS — MAKE THEM DEVELOP, NOT DIE**:
- Use "is_reply_to" to build at least 2 reply chains. At least ONE must be a real escalating argument of 3-5 replies.
- Replies branch: two people reply to the same comment; someone replies to a reply. Tangled and alive.

**MEMES, POP-CULTURE, GAGS**:
- Use real internet humor, meme formats, brainrot, fake breaking-news tone, reaction-image descriptions, outside references.

**ANTI-ECHO — STRICT**:
- NEVER quote, copy, or paraphrase the roleplay text. Don't restate what happened. React, don't summarize.
- All comments UNIQUE — no two make the same point or structure.

**FOCUS**: React mainly to the NEWEST twist/latest events (both character and user actions count). Older events only as background/comparison.

**NAMES — STRICT & VARIED**:
- TWO SEPARATE FIELDS:
  1) "display_name" — visible nickname, Russian/Cyrillic in Russian mode, absurd/weird/meme-y/brainrot. NEVER Latin in Russian mode.
  2) "username" — @handle, English lowercase Latin, _ or digits ok, short funny.
- display_name is NOT a translation/transliteration of username and vice versa. Invent each INDEPENDENTLY.
- Do NOT reuse usernames/display_names from previous comment sections unless intentionally bringing back 1-2 regulars.

**NO SELF-AUTHORED / OP COMMENTS**: Commenters are always THIRD-PARTY observers/fans. NEVER write a comment as if it is by the post's author/OP/creator.

STRUCTURE:
{
  "comments": [
    { "username": "english handle no @", "display_name": "visible nickname", "avatar_emoji": "single emoji", "verified": true/false, "comment": "text, distinct voice", "likes": number, "retweets": number, "replies": number, "time": "2m/1h/3d", "is_reply_to": null or 0-based index }
  ]
}

**TWITTER LENGTH**: Each comment max ~280 chars. Punchy, chaotic, internet-speak.
**ENGAGEMENT NUMBERS**: Vary realistically — viral banger thousands of likes; buried/ratio'd troll near-zero likes but angry replies.
Swearing, dark humor, toxic arguing, sarcasm, meme slang ALLOWED where fitting. ${languageRule}${authorBlock}
</social_comments>]`;
}