// RoleCall — all backend communication lives here.
// Update VITE_API_URL in .env.local to point at your Railway server.

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function post(path, body) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Full job search pipeline — returns { jobs, candidateProfile, alignment } */
export async function findJobs(resumeText, preferences) {
  return post("/jobs", { resumeText, preferences });
}

/** Generate a cover letter for a specific matched job */
export async function generateCoverLetter(job, candidateProfile, resumeText) {
  return post("/cover-letter", { job, candidateProfile, resumeText });
}

/** Generate an application checklist for a specific job */
export async function generateChecklist(job, candidateProfile) {
  return post("/checklist", { job, candidateProfile });
}

/** Health check — confirms backend is live */
export async function checkHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
