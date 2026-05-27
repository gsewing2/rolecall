import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function extractJSON(text) {
  const stripped = text.replace(/```json|```/g, "").trim();
  const match = stripped.match(/(\{[\s\S]*\})/);
  if (!match) throw new Error(`No JSON object found in response: ${stripped.slice(0, 100)}`);
  return JSON.parse(match[1]);
}

/**
 * Parses raw resume text into a structured candidate profile.
 * This runs once at the start and is used by all downstream matching logic.
 */
export async function parseResume(rawText) {
  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are an expert legal career analyst. Extract a precise, structured profile from this resume.

RESUME:
${rawText.slice(0, 4000)}

Extract and return ONLY valid JSON, no markdown:
{
  "name": "",
  "bar_admissions": ["NY", "CA"],
  "education": [
    { "school": "", "degree": "", "year": 0, "honors": "" }
  ],
  "years_total_experience": 0,
  "practice_areas": [
    {
      "name": "",
      "years": 0,
      "proficiency": "primary|secondary|exposure",
      "keywords": ["specific skills, deal types, or case types mentioned"]
    }
  ],
  "settings_worked_in": ["BigLaw", "Government", "In-House"],
  "current_role": "",
  "current_employer": "",
  "notable_employers": [""],
  "deal_or_case_highlights": ["brief description of notable matters"],
  "skills": {
    "technical": ["e.g. contract drafting, due diligence, appellate advocacy"],
    "industry": ["e.g. healthcare, fintech, real estate"],
    "soft": ["e.g. client management, deposition, negotiation"]
  },
  "underutilized_skills": ["skills present in resume that are rarely featured — good wildcard signals"],
  "career_trajectory": "ascending|lateral|transitioning|unclear",
  "transition_signals": ["any language suggesting desired change in direction"],
  "inferred_strengths": ["top 3-5 genuine strengths based on resume evidence"],
  "potential_gaps": ["areas that may need addressing for target roles"]
}`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return extractJSON(text);
}

/**
 * Checks alignment between what the resume shows and what the candidate says they want.
 * Returns a "preference alignment" object used to weight matching.
 */
export async function alignPreferences(candidateProfile, preferences) {
  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `You are a legal career advisor. Analyze the alignment between what this candidate's resume shows and what they say they want.

CANDIDATE PROFILE (from resume):
${JSON.stringify(candidateProfile, null, 2)}

STATED PREFERENCES:
- Target role: ${preferences.role}
- Practice areas: ${(preferences.area || []).join(", ")}
- Preferred settings: ${(preferences.setting || []).join(", ")}
- Location: ${preferences.location}
- Salary target: ${preferences.salary}
- Open to wildcards: ${preferences.wild}

Return ONLY valid JSON:
{
  "alignment_score": 85,
  "alignment_notes": "brief summary of fit between resume and goals",
  "strong_matches": ["areas where resume strongly supports stated goals"],
  "tension_points": ["areas where resume and stated goals diverge"],
  "transition_difficulty": "easy|moderate|significant|major",
  "recommended_framing": "how this candidate should position themselves for their target",
  "wildcard_basis": ["specific underutilized skills from resume that justify wildcard suggestions"],
  "match_weights": {
    "practice_area_weight": 0.35,
    "setting_weight": 0.20,
    "experience_weight": 0.20,
    "location_weight": 0.15,
    "salary_weight": 0.10
  }
}

Adjust match_weights based on the candidate's situation — e.g. if they're transitioning, weight transferable skills higher than practice area exact match.`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return extractJSON(text);
}
