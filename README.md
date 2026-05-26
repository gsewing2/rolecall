# RoleCall

> Your name is being called.

AI-powered job matcher. Upload your resume, answer 7 questions, swipe through matches tailored to your actual background — not just keywords.

## Stack

```
client/ (React + Vite)  →  server/ (Express on Railway)
                               ├── Anthropic API (resume parsing + semantic matching)
                               └── JSearch / RapidAPI (live job listings)
```

---

## Local Setup with Claude Code

```bash
# 1. Open Claude Code in this directory
cd rolecall
claude

# 2. Tell it:
# "Run npm install in both server/ and client/, copy .env.example to .env
#  in server/ and .env.example to .env.local in client/, then start both servers"
```

Or manually:
```bash
# Server
cd server
npm install
cp .env.example .env
# Edit .env — add ANTHROPIC_API_KEY

# Client (new terminal)
cd client
npm install
cp .env.example .env.local
npm run dev
```

---

## Deploy

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "RoleCall initial commit"
gh repo create rolecall --public --push
```

### 2. Deploy server on Railway
1. railway.app → New Project → GitHub repo → `rolecall`
2. Root Directory: `server`
3. Variables:
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com
   - `RAPIDAPI_KEY` = from rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch (optional)
   - `CLIENT_URL` = your client URL (add after step 3)
4. Copy the Railway server URL (e.g. `rolecall-server.up.railway.app`)

### 3. Deploy client on Railway
1. New Service → same repo → Root Directory: `client`
2. Build command: `npm run build`
3. Start command: `npx vite preview --port $PORT --host`
4. Variables:
   - `VITE_API_URL` = https://your-server.up.railway.app

### 4. Connect them
- Set `CLIENT_URL` on server = your client Railway URL
- Redeploy server

### 5. Custom domain (optional)
Railway → Service → Settings → Custom Domain
Buy at namecheap.com (~$12/yr), point CNAME to Railway target

---

## API Keys

| Key | Where | Required |
|-----|-------|----------|
| `ANTHROPIC_API_KEY` | console.anthropic.com | ✅ Yes |
| `RAPIDAPI_KEY` | rapidapi.com → JSearch (free: 200 req/mo) | Optional |

---

## Endpoints

```
POST /api/jobs          — Parse resume → align preferences → fetch → score
POST /api/cover-letter  — Generate cover letter for a matched job
POST /api/checklist     — Generate application checklist
GET  /health            — Server status
```

---

## How the matching works

1. **Resume parsing** — Extracts structured profile: skills, experience by area, trajectory, underutilized skills
2. **Preference alignment** — Checks gap between what your resume shows vs what you want, adjusts match weights accordingly
3. **Live listings** — JSearch pulls real postings from Google for Jobs (LinkedIn, Indeed, Glassdoor, etc.)
4. **Semantic scoring** — Single Claude batch call scores all listings against your actual profile, not just keywords
5. **Wildcards** — Based on underutilized skills from your resume, not random
