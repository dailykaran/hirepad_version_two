// Test parseJsonFromText directly

function parseJsonFromText(text, openChar = '{', closeChar = '}') {
  if (!text || typeof text !== 'string') return null;

  // 1) Try direct JSON.parse
  try {
    const trimmed = text.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return JSON.parse(trimmed);
    }
  } catch (e) {
    // fallthrough
  }

  // 2) Try to find a fenced code block with ```json or ```
  const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeFenceMatch && codeFenceMatch[1]) {
    try {
      return JSON.parse(codeFenceMatch[1].trim());
    } catch (e) {
      console.log('Code fence parse error:', e.message);
      // continue to next strategy
    }
  }
  // 3) Find the first balanced JSON structure by scanning for the first openChar and matching depth
  const firstStart = text.indexOf(openChar);
  if (firstStart !== -1) {
    let depth = 0;
    for (let i = firstStart; i < text.length; i++) {
      const ch = text[i];
      if (ch === openChar) depth++;
      else if (ch === closeChar) depth--;

      if (depth === 0) {
        const candidate = text.slice(firstStart, i + 1);
        const parsed = tryParseJson(candidate);
        if (parsed !== null) return parsed;
        break; // if first balanced candidate failed, continue to broader search below
      }
    }
  }

  // 4) Try scanning all bracket spans (helpful if there are multiple JSON snippets or extra text)
  for (let s = 0; s < text.length; s++) {
    if (text[s] !== openChar) continue;
    let depth = 0;
    for (let j = s; j < text.length; j++) {
      const ch = text[j];
      if (ch === openChar) depth++;
      else if (ch === closeChar) depth--;
      if (depth === 0) {
        const candidate = text.slice(s, j + 1);
        const parsed = tryParseJson(candidate);
        if (parsed !== null) return parsed;
        break;
      }
    }
  }

  return null;
}

function tryParseJson(candidate) {
  try {
    return JSON.parse(candidate);
  } catch (e) {
    // Attempt heuristic fixes: replace smart quotes, convert single quotes to double, and remove trailing commas
    try {
      let fixed = candidate.replace(/['']/g, '"').replace(/[""]/g, '"');
      fixed = fixed.replace(/'([^']*)'/g, '"$1"');
      fixed = fixed.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(fixed);
    } catch (e2) {
      return null;
    }
  }
}

const response = `\`\`\`json
[
  "Can you describe a challenging technical problem you solved using React or Node.js, and what was your approach to finding a solution?",
  "Tell me about a time you faced a significant technical roadblock in a project. How did you identify the root cause, and what steps did you take to overcome it?",
  "How do you typically explain complex technical concepts or decisions to non-technical team members or stakeholders?",
  "Describe a situation where you had to collaborate closely with other developers or teams on a project. What was your role, and how did you ensure effective teamwork?",
  "Looking back at your 5 years of experience, what has been the most significant learning or growth experience for you as a software developer, and why?",
  "What are you looking for in your next role, and how do you see it aligning with your long-term career goals?",
  "Beyond React and Node.js, what other areas of software development are you particularly passionate about or have explored, such as system architecture, testing methodologies, or cloud deployments?"
]
\`\`\``;

console.log('Testing parseJsonFromText with array...');
const result = parseJsonFromText(response, '[', ']');
if (result) {
  console.log('✅ Successfully parsed!');
  console.log('Count:', result.length);
  console.log('First:', result[0]);
} else {
  console.log('❌ Failed to parse');
}
