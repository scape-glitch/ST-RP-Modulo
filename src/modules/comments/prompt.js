function formatState(state) {
  try { return JSON.stringify(state ?? null, null, 2); } catch (_) { return 'null'; }
}

export function buildPrompt({ lang = 'ru', previousState = null }) {
  const languageRule = lang === 'ru' ? 'All comments must be Russian, with natural slang where appropriate.' : 'All comments must be English, with natural internet slang where appropriate.';
  return `[System Note: Generate a fictional Twitter/X comment section reacting to the newest roleplay events.

Previous comments state:
${formatState(previousState)}

Instruction:
Use previous author replies, user replies, likes and section context. Continue naturally. Do not forget author/user replies.

At the end output ONLY this XML/HTML block with valid JSON inside an HTML comment: <social_comments><!-- {"comments":[{"id":"stable-id","username":"handle","display_name":"ник","avatar_emoji":"💬","verified":false,"comment":"text","likes":0,"retweets":0,"replies":0,"time":"now","is_reply_to":null}]} --></social_comments>. Produce 4 to 8 varied commenters. Do not impersonate the story author/player. ${languageRule}]`;
}