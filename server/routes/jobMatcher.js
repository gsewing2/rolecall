import Anthropic from "@anthropic-ai/sdk";
import fetch from "node-fetch";

const client = new Anthropic();

function extractJSON(text) {
  const stripped = text.replace(/```json|```/g, "").trim();
  const match = stripped.match(/(\{[\s\S]*\})/);
  if (!match) throw new Error(`No JSON object found in response: ${stripped.slice(0, 100)}`);
  return JSON.parse(match[1]);
}

/**
 * Fetches real job listings from JSearch (Google for Jobs aggregator).
 * Runs multiple targeted queries to maximize coverage.
 */
export async function fetchRealListings(candidateProfile, preferences, rapidApiKey) {
  const queries = buildSearchQueries(candidateProfile, preferences);
  const allJobs = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      const res = await fetch(
        `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=2&country=us&date_posted=month`,
        {
          headers: {
            "X-RapidAPI-Key": rapidApiKey,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
        }
      );
      const data = await res.json();
      if (data.data) {
        for (const job of data.data) {
          if (!seen.has(job.job_id)) {
            seen.add(job.job_id);
            allJobs.push(normalizeJob(job));
          }
        }
      }
    } catch (err) {
      console.error(`JSearch query failed: ${query}`, err.message);
    }
  }

  return allJobs;
}

/**
 * Builds targeted search queries from the candidate profile + preferences.
 * More specific queries = better quality results than one broad query.
 */
function buildSearchQueries(profile, preferences) {
  const role = preferences.role || profile.current_role || "attorney";
  const location = preferences.location || "United States";
  const primaryArea = profile.practice_areas?.[0]?.name || (preferences.area || [])[0] || "legal";

  const queries = [
    // Core target role
    `${role} ${primaryArea} ${location}`,
    // By setting preference
    ...(preferences.setting || []).slice(0, 2).map(
      (s) => `${role} ${s} ${location}`
    ),
    // Wildcard: underutilized skills
    ...(profile.underutilized_skills || []).slice(0, 2).map(
      (skill) => `legal ${skill} ${location}`
    ),
  ];

  // Deduplicate and limit to 5 queries (API efficiency)
  return [...new Set(queries)].slice(0, 5);
}

/**
 * Normalizes a raw JSearch result into a clean object for matching.
 */
function normalizeJob(raw) {
  return {
    id: raw.job_id,
    title: raw.job_title,
    company: raw.employer_name,
    location: [raw.job_city, raw.job_state].filter(Boolean).join(", ") || raw.job_country || "Not listed",
    remote: raw.job_is_remote,
    salary: raw.job_min_salary
      ? `$${(raw.job_min_salary / 1000).toFixed(0)}k–$${(raw.job_max_salary / 1000).toFixed(0)}k`
      : "Not listed",
    posted: raw.job_posted_at_datetime_utc,
    apply_url: raw.job_apply_link || raw.job_google_link || "",
    description: (raw.job_description || "").slice(0, 600),
    highlights: raw.job_highlights || {},
    source: raw.job_publisher || "Job Board",
  };
}

/**
 * Core matching function.
 * Scores each job against the candidate profile using Claude,
 * applying preference alignment weights for accuracy.
 */
export async function scoreAndRankJobs(listings, candidateProfile, alignment, preferences) {
  if (!listings.length) return [];

  const weights = alignment.match_weights;

  // Batch all listings into one Claude call for efficiency
  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `You are a precise legal career matchmaker. Score each job listing against this candidate profile.

CANDIDATE PROFILE:
- Name: ${candidateProfile.name}
- Experience: ${candidateProfile.years_total_experience} years total
- Practice areas: ${candidateProfile.practice_areas?.map((a) => `${a.name} (${a.years}yrs, ${a.proficiency})`).join(", ")}
- Settings worked in: ${(candidateProfile.settings_worked_in || []).join(", ")}
- Key skills: ${[...(candidateProfile.skills?.technical || []), ...(candidateProfile.skills?.industry || [])].slice(0, 10).join(", ")}
- Underutilized skills: ${(candidateProfile.underutilized_skills || []).join(", ")}
- Career trajectory: ${candidateProfile.career_trajectory}
- Inferred strengths: ${(candidateProfile.inferred_strengths || []).join(", ")}

STATED PREFERENCES:
- Target role: ${preferences.role}
- Practice areas wanted: ${(preferences.area || []).join(", ")}
- Settings wanted: ${(preferences.setting || []).join(", ")}
- Location: ${preferences.location}
- Salary target: ${preferences.salary}
- Open to wildcards: ${preferences.wild}

ALIGNMENT CONTEXT:
- Transition difficulty: ${alignment.transition_difficulty}
- Recommended framing: ${alignment.recommended_framing}
- Wildcard basis: ${(alignment.wildcard_basis || []).join(", ")}

SCORING WEIGHTS (must sum to 1.0):
- Practice area match: ${weights.practice_area_weight}
- Setting match: ${weights.setting_weight}
- Experience fit: ${weights.experience_weight}
- Location match: ${weights.location_weight}
- Salary match: ${weights.salary_weight}

JOB LISTINGS TO SCORE:
${listings.map((j, i) => `
[${i + 1}] ${j.title} at ${j.company}
Location: ${j.location} ${j.remote ? "(Remote available)" : ""}
Salary: ${j.salary}
Description: ${j.description}
`).join("\n")}

INSTRUCTIONS:
1. Score each job 0–100 using the weights above
2. A job can score high even with lower practice area match if the candidate's transferable skills are strong (based on alignment context)
3. Mark jobs as wildcard: true if they leverage underutilized skills or represent a smart adjacent move — NOT just because they're different
4. Write "why" text that references SPECIFIC details from BOTH the candidate profile AND the job description
5. Select and return the 7 best matches + 3 best wildcards (10 total)
6. For the "tags" field, extract real tags from the job listing (not generic ones)

Return ONLY valid JSON:
{
  "jobs": [
    {
      "id": "original_job_id_here",
      "title": "",
      "company": "",
      "location": "",
      "salary": "",
      "match": 92,
      "wildcard": false,
      "tags": ["from actual listing"],
      "why": "Specific: references candidate's [skill/experience] matched to this role's [specific requirement]",
      "highlights": ["real detail from listing", "real requirement", "real benefit"],
      "where_to_apply": "direct URL",
      "deadline_hint": ""
    }
  ]
}`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = extractJSON(text);

  // Merge back the apply URLs from original listings where Claude may have lost them
  const listingMap = Object.fromEntries(listings.map((j) => [j.id, j]));
  return parsed.jobs.map((job) => ({
    ...job,
    where_to_apply: job.where_to_apply || listingMap[job.id]?.apply_url || "",
  }));
}

/**
 * Fallback: if JSearch is unavailable, use Claude web search to find real listings.
 * Less structured but still grounded in real postings.
 */
export async function fetchViaWebSearch(candidateProfile, preferences) {
  const role = preferences.role || "attorney";
  const area = (preferences.area || [])[0] || "legal";
  const location = preferences.location || "United States";

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2000,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [
      {
        role: "user",
        content: `Search for real, currently open legal job postings for:
- Role: ${role}
- Practice area: ${area}
- Location: ${location}
- Experience: ${candidateProfile.years_total_experience} years

Search LinkedIn, Indeed, law.com/careers, Above the Law job board, NALP, USAJobs, BCG Attorney Search, and LawCrossing.
Also search for 3 adjacent roles that would suit someone with skills in: ${(candidateProfile.underutilized_skills || []).join(", ")}.

Return raw text of all listings found — real jobs only.`,
      },
    ],
  });

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
