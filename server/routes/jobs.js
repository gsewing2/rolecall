import express from "express";
import { parseResume, alignPreferences } from "./resumeParser.js";
import { fetchRealListings, scoreAndRankJobs, fetchViaWebSearch } from "./jobMatcher.js";
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();
const client = new Anthropic();

/**
 * POST /api/jobs
 * Full pipeline: parse resume → align preferences → fetch listings → score & rank
 *
 * Body: { resumeText, preferences }
 * Returns: { jobs, candidateProfile, alignment }
 */
router.post("/jobs", async (req, res) => {
  const { resumeText, preferences } = req.body;

  if (!preferences) {
    return res.status(400).json({ error: "preferences required" });
  }

  try {
    // ── Phase 0: Parse resume ─────────────────────────────────────────────────
    let candidateProfile;
    if (resumeText?.trim()) {
      console.log("[RoleCall] Phase 1/3 — Parsing resume...");
      candidateProfile = await parseResume(resumeText);
    } else {
      // No resume: build minimal profile from preferences
      candidateProfile = {
        name: "Candidate",
        years_total_experience: estimateYears(preferences.exp),
        practice_areas: (preferences.area || []).map((a) => ({
          name: a,
          years: estimateYears(preferences.exp),
          proficiency: "primary",
          keywords: [],
        })),
        settings_worked_in: preferences.setting || [],
        current_role: preferences.role || "Professional",
        skills: { technical: [], industry: [], soft: [] },
        underutilized_skills: [],
        career_trajectory: "unclear",
        transition_signals: [],
        inferred_strengths: [],
        potential_gaps: [],
      };
    }

    // ── Phase 1: Align preferences ────────────────────────────────────────────
    console.log("[RoleCall] Phase 2/3 — Aligning preferences...");
    const alignment = await alignPreferences(candidateProfile, preferences);

    // ── Phase 2: Fetch real listings ──────────────────────────────────────────
    console.log("[RoleCall] Phase 3/3 — Fetching and matching listings...");
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    let listings = [];

    if (rapidApiKey) {
      listings = await fetchRealListings(candidateProfile, preferences, rapidApiKey);
      console.log(`  JSearch: ${listings.length} listings found`);
    }

    if (!listings.length) {
      console.log("  Falling back to web search...");
      const rawText = await fetchViaWebSearch(candidateProfile, preferences);
      const jobs = await scoreFromRawText(rawText, candidateProfile, alignment, preferences);
      return res.json({ jobs, candidateProfile, alignment, source: "web_search" });
    }

    // ── Phase 3: Score and rank ───────────────────────────────────────────────
    const jobs = await scoreAndRankJobs(listings, candidateProfile, alignment, preferences);

    res.json({
      jobs,
      candidateProfile,
      alignment,
      source: "jsearch",
      listingsSearched: listings.length,
    });
  } catch (err) {
    console.error("[RoleCall] Pipeline error:", err);
    res.status(500).json({ error: "Job matching failed. Please try again.", detail: err.message });
  }
});

/**
 * POST /api/cover-letter
 * Generates a targeted cover letter from candidate profile + job details.
 */
router.post("/cover-letter", async (req, res) => {
  const { resumeText, job, candidateProfile } = req.body;
  if (!job) return res.status(400).json({ error: "job details required" });

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Write a targeted, compelling cover letter for this position.

JOB:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Why it fits: ${job.why}
- Key highlights: ${(job.highlights || []).join("; ")}

CANDIDATE PROFILE:
${candidateProfile ? JSON.stringify(candidateProfile, null, 2) : ""}
${resumeText ? `\nRESUME:\n${resumeText.slice(0, 2000)}` : ""}

Write a 3-paragraph cover letter that:
1. Opens with a specific hook referencing the role and company — not generic
2. Middle paragraph: connects 2-3 specific experiences from the resume to specific requirements of this role
3. Closes with genuine enthusiasm and a clear ask

Tone: confident, specific, not sycophantic. No "I am writing to express my interest."
Format: plain text, ready to paste. Include [Date] and [Your Address] placeholders at top.`,
        },
      ],
    });

    const letter = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    res.json({ letter });
  } catch (err) {
    console.error("[RoleCall] Cover letter error:", err);
    res.status(500).json({ error: "Cover letter generation failed." });
  }
});

/**
 * POST /api/checklist
 * Generates a tailored application checklist for a specific job.
 */
router.post("/checklist", async (req, res) => {
  const { job, candidateProfile } = req.body;
  if (!job) return res.status(400).json({ error: "job required" });

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `Create a specific, actionable application checklist for this candidate and role.

JOB: ${job.title} at ${job.company}
Tags: ${(job.tags || []).join(", ")}
Where to apply: ${job.where_to_apply}
${candidateProfile ? `Candidate gaps: ${(candidateProfile.potential_gaps || []).join(", ")}` : ""}

Return JSON only:
{
  "checklist": [
    { "item": "specific action", "priority": "high|medium|low", "note": "why this matters for THIS role" }
  ],
  "timeline": "suggested timeline (e.g. 'Apply within 2 weeks')",
  "insider_tip": "one specific, actionable tip for this company/role type"
}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    res.status(500).json({ error: "Checklist generation failed." });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function estimateYears(expString) {
  if (!expString) return 3;
  if (expString.includes("0–2")) return 1;
  if (expString.includes("3–5")) return 4;
  if (expString.includes("6–10")) return 8;
  if (expString.includes("10+")) return 12;
  return 3;
}

async function scoreFromRawText(rawText, candidateProfile, alignment, preferences) {
  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `Score and rank these job listings for this candidate. Select 7 best matches + 3 wildcards.

CANDIDATE: ${candidateProfile.years_total_experience} yrs exp, skills: ${candidateProfile.practice_areas?.map((a) => a.name).join(", ")}, trajectory: ${candidateProfile.career_trajectory}
PREFERENCES: ${preferences.role} | ${(preferences.area || []).join(", ")} | ${preferences.location} | ${preferences.salary}
FRAMING: ${alignment.recommended_framing}

RAW LISTINGS:
${rawText.slice(0, 3000)}

Return ONLY valid JSON:
{
  "jobs": [{ "id": 1, "title": "", "company": "", "location": "", "salary": "Not listed", "match": 85, "wildcard": false, "tags": [], "why": "", "highlights": ["", "", ""], "where_to_apply": "", "deadline_hint": "" }]
}`,
      },
    ],
  });

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean).jobs;
}

export default router;
