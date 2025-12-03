// Test the parser with actual Gemini responses

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
      const extracted = codeFenceMatch[1].trim();
      console.log('Extracted from fence:', extracted.substring(0, 100));
      return JSON.parse(extracted);
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
        break;
      }
    }
  }

  // 4) Try scanning all bracket spans
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

// Test with actual response from logs
const testResponse = `\`\`\`json
{
  "score": 5,
  "feedback": "The response provided did not address the question asked. It appears to be a series of disjointed phrases, possibly indicating a technical issue or a misunderstanding of the question.",
  "strengths": ["Attempted to engage with the question"],
  "improvements": ["Need clearer articulation", "Should directly address the question"]
}
\`\`\``;

console.log('Testing with code fence response...');
console.log('Input length:', testResponse.length);
const result = parseJsonFromText(testResponse, '{', '}');
if (result) {
  console.log('✅ Parsed successfully!');
  console.log('Score:', result.score);
  console.log('Feedback:', result.feedback);
} else {
  console.log('❌ Parse failed');
}
