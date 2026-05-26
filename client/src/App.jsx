import { useState, useRef } from "react";
import { findJobs, generateCoverLetter, generateChecklist } from "./api.js";

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap";

const QUESTIONS = [
  { id: "role", label: "What role are you targeting?", type: "text", placeholder: "e.g. Software Engineer, Product Manager, Attorney, Designer…" },
  { id: "area", label: "Your area of expertise?", type: "chips-multi", options: ["Technology", "Legal", "Finance", "Design", "Marketing", "Operations", "Healthcare", "Consulting", "Product", "Data / Analytics", "Other"] },
  { id: "exp", label: "Years of experience?", type: "chips", options: ["0–2 yrs", "3–5 yrs", "6–10 yrs", "10+ yrs"] },
  { id: "setting", label: "Where do you want to work?", type: "chips-multi", options: ["Startup", "Enterprise", "Agency / Firm", "Government", "Nonprofit", "Remote-first", "Hybrid", "In-office"] },
  { id: "location", label: "Target location?", type: "text", placeholder: "e.g. New York, Remote, Austin…" },
  { id: "salary", label: "Minimum salary?", type: "chips", options: ["< $60k", "$60k–$100k", "$100k–$150k", "$150k–$220k", "$220k+", "Flexible"] },
  { id: "wild", label: "Open to unexpected roles?", type: "chips", options: ["Yes — surprise me", "Maybe, if compelling", "No — stay focused"] },
];

const C = {
  bg: "#0a0a0a",
  card: "#111111",
  cardAlt: "#161616",
  ink: "#f0ede8",
  muted: "#666",
  accent: "#e8ff47",
  accentDim: "rgba(232,255,71,0.12)",
  pass: "#ff4d4d",
  like: "#47ff8f",
  border: "#222",
  shadow: "rgba(0,0,0,0.6)",
};

export default function App() {
  const [phase, setPhase] = useState("landing");
  const [resume, setResume] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [answers, setAnswers] = useState({});
  const [qIndex, setQIndex] = useState(0);
  const [jobs, setJobs] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [liked, setLiked] = useState([]);
  const [flipped, setFlipped] = useState(false);
  const [actionJob, setActionJob] = useState(null);
  const [actionMode, setActionMode] = useState(null); // "cover" | "checklist" | null
  const [actionContent, setActionContent] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [candidateProfile, setCandidateProfile] = useState(null);
  const [alignment, setAlignment] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [dragState, setDragState] = useState({ dragging: false, x: 0, startX: 0 });
  const [swipeAnim, setSwipeAnim] = useState(null);

  function handleResumeUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setResume(file.name);
    const reader = new FileReader();
    reader.onload = ev => setResumeText(ev.target.result.slice(0, 4000));
    reader.readAsText(file);
  }

  function answerQuestion(value) {
    setAnswers(prev => ({ ...prev, [QUESTIONS[qIndex].id]: value }));
  }
  function toggleChip(id, val) {
    setAnswers(prev => {
      const cur = prev[id] || [];
      return { ...prev, [id]: cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val] };
    });
  }
  function nextQ() {
    if (qIndex < QUESTIONS.length - 1) setQIndex(q => q + 1);
    else startSearch();
  }
  function prevQ() { if (qIndex > 0) setQIndex(q => q - 1); }

  async function startSearch() {
    setError("");
    setPhase("loading");
    setLoadingMsg("Parsing your background…");
    try {
      setLoadingMsg("Fetching live listings…");
      const result = await findJobs(resumeText, answers);
      setJobs(result.jobs || []);
      setCandidateProfile(result.candidateProfile);
      setAlignment(result.alignment);
      setCardIndex(0);
      setPhase("cards");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setPhase("onboard");
    }
  }

  function doSwipe(dir) {
    setSwipeAnim(dir);
    if (dir === "right") setLiked(prev => [...prev, jobs[cardIndex]]);
    setTimeout(() => {
      setSwipeAnim(null);
      setFlipped(false);
      if (cardIndex + 1 >= jobs.length) setPhase("done");
      else setCardIndex(i => i + 1);
    }, 380);
  }

  function onMouseDown(e) { setDragState({ dragging: true, x: 0, startX: e.clientX }); }
  function onMouseMove(e) { if (!dragState.dragging) return; setDragState(d => ({ ...d, x: e.clientX - d.startX })); }
  function onMouseUp() {
    if (!dragState.dragging) return;
    const dx = dragState.x;
    setDragState({ dragging: false, x: 0, startX: 0 });
    if (dx > 80) doSwipe("right");
    else if (dx < -80) doSwipe("left");
  }
  function onTouchStart(e) { setDragState({ dragging: true, x: 0, startX: e.touches[0].clientX }); }
  function onTouchMove(e) { if (!dragState.dragging) return; setDragState(d => ({ ...d, x: e.touches[0].clientX - d.startX })); }
  function onTouchEnd() { onMouseUp(); }

  async function openAction(job, mode) {
    setActionJob(job);
    setActionMode(mode);
    setActionContent("");
    setActionLoading(true);
    try {
      if (mode === "cover") {
        const res = await generateCoverLetter(job, candidateProfile, resumeText);
        setActionContent(res.letter);
      } else if (mode === "checklist") {
        const res = await generateChecklist(job, candidateProfile);
        setActionContent(res);
      }
    } catch {
      setActionContent("Something went wrong generating this. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  const job = jobs[cardIndex];
  const dragX = dragState.dragging ? dragState.x : 0;
  const dragRot = dragState.dragging ? dragState.x * 0.04 : 0;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'DM Sans', sans-serif" }}>
      <link rel="stylesheet" href={FONT_LINK} />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .chip { cursor: pointer; padding: 9px 18px; border-radius: 100px; border: 1px solid ${C.border}; font-size: 13px; transition: all 0.15s; background: transparent; color: ${C.muted}; font-family: 'DM Sans', sans-serif; }
        .chip:hover { border-color: ${C.accent}; color: ${C.accent}; }
        .chip.active { background: ${C.accent}; color: ${C.bg}; border-color: ${C.accent}; font-weight: 600; }
        .card-flip { perspective: 1200px; }
        .card-inner { transition: transform 0.5s cubic-bezier(.4,0,.2,1); transform-style: preserve-3d; position: relative; }
        .card-inner.flipped { transform: rotateY(180deg); }
        .card-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .card-back-face { transform: rotateY(180deg); }
        @keyframes swipeLeft { to { transform: translateX(-140%) rotate(-18deg); opacity: 0; } }
        @keyframes swipeRight { to { transform: translateX(140%) rotate(18deg); opacity: 0; } }
        .swipe-left { animation: swipeLeft 0.38s ease forwards; }
        .swipe-right { animation: swipeRight 0.38s ease forwards; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.45s ease both; }
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=text], textarea { background: #111; border: 1px solid ${C.border}; border-radius: 10px; padding: 12px 16px; font-size: 15px; font-family: 'DM Sans', sans-serif; color: ${C.ink}; width: 100%; outline: none; transition: border-color 0.15s; resize: vertical; }
        input[type=text]:focus, textarea:focus { border-color: ${C.accent}; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>

      {/* ── LANDING ─────────────────────────────────────────────────────────── */}
      {phase === "landing" && (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: 6, color: C.accent, textTransform: "uppercase", marginBottom: 24, fontFamily: "'Syne', sans-serif" }}>
            Your name is being called
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(52px,10vw,96px)", fontWeight: 800, lineHeight: 0.95, marginBottom: 28, letterSpacing: "-2px" }}>
            Role<span style={{ color: C.accent }}>Call</span>
          </h1>
          <p style={{ fontSize: 16, color: C.muted, maxWidth: 380, lineHeight: 1.7, marginBottom: 52 }}>
            Upload your resume, answer 7 questions, swipe through AI-matched opportunities tailored to your background.
          </p>

          <label style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            border: `1px dashed ${resume ? C.accent : C.border}`, borderRadius: 16,
            padding: "28px 40px", cursor: "pointer",
            background: resume ? "rgba(232,255,71,0.04)" : "transparent",
            marginBottom: 28, width: "100%", maxWidth: 400, transition: "all 0.2s"
          }}>
            <span style={{ fontSize: 28 }}>{resume ? "✓" : "↑"}</span>
            <span style={{ fontSize: 14, color: resume ? C.accent : C.muted, fontWeight: 500 }}>
              {resume ? resume : "Upload resume (optional but recommended)"}
            </span>
            <span style={{ fontSize: 12, color: "#444" }}>.txt, .pdf, .doc accepted</span>
            <input type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: "none" }} onChange={handleResumeUpload} />
          </label>

          <button onClick={() => setPhase("onboard")} style={{
            background: C.accent, color: C.bg, border: "none", borderRadius: 100,
            padding: "16px 52px", fontSize: 15, fontWeight: 700, cursor: "pointer",
            fontFamily: "'Syne', sans-serif", letterSpacing: 1,
          }}>
            Start →
          </button>
        </div>
      )}

      {/* ── ONBOARDING ──────────────────────────────────────────────────────── */}
      {phase === "onboard" && (() => {
        const q = QUESTIONS[qIndex];
        const cur = answers[q.id];
        return (
          <div className="fade-up" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", padding: "40px 24px" }}>
            <div style={{ display: "flex", gap: 5, maxWidth: 480, margin: "0 auto 52px", width: "100%" }}>
              {QUESTIONS.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: i <= qIndex ? C.accent : C.border, transition: "background 0.3s" }} />
              ))}
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 520, margin: "0 auto", width: "100%" }}>
              <div style={{ fontSize: 11, letterSpacing: 4, color: C.accent, textTransform: "uppercase", marginBottom: 14, fontFamily: "'Syne',sans-serif" }}>
                {qIndex + 1} / {QUESTIONS.length}
              </div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(22px,4vw,34px)", fontWeight: 700, marginBottom: 36, lineHeight: 1.2 }}>
                {q.label}
              </h2>

              {q.type === "text" && (
                <input type="text" placeholder={q.placeholder} value={cur || ""}
                  onChange={e => answerQuestion(e.target.value)} style={{ marginBottom: 40 }} />
              )}
              {(q.type === "chips" || q.type === "chips-multi") && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 40 }}>
                  {q.options.map(opt => {
                    const isMulti = q.type === "chips-multi";
                    const isActive = isMulti ? (cur || []).includes(opt) : cur === opt;
                    return (
                      <button key={opt} className={`chip${isActive ? " active" : ""}`}
                        onClick={() => isMulti ? toggleChip(q.id, opt) : answerQuestion(opt)}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {error && <p style={{ color: C.pass, fontSize: 13, marginBottom: 16 }}>{error}</p>}

              <div style={{ display: "flex", gap: 12, marginTop: "auto" }}>
                {qIndex > 0 && (
                  <button onClick={prevQ} style={{ flex: 1, padding: "14px", border: `1px solid ${C.border}`, borderRadius: 100, background: "transparent", cursor: "pointer", fontSize: 14, color: C.muted, fontFamily: "'DM Sans',sans-serif" }}>← Back</button>
                )}
                <button onClick={nextQ} style={{
                  flex: 2, padding: "14px", background: C.accent, color: C.bg,
                  border: "none", borderRadius: 100, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif", letterSpacing: 0.5
                }}>
                  {qIndex === QUESTIONS.length - 1 ? "Find My Matches →" : "Next →"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── LOADING ─────────────────────────────────────────────────────────── */}
      {phase === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 28, padding: 40 }}>
          <div style={{ width: 48, height: 48, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Finding your matches</p>
            <p style={{ fontSize: 13, color: C.muted }}>{loadingMsg}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 300, width: "100%" }}>
            {[
              { label: "Parsing resume & extracting skills", done: loadingMsg.includes("Fetching") || loadingMsg.includes("Matching") },
              { label: "Fetching live listings from job boards", done: loadingMsg.includes("Matching") },
              { label: "AI scoring against your profile", done: false },
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, background: step.done ? C.like : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.bg, fontWeight: 700, transition: "background 0.4s" }}>
                  {step.done ? "✓" : ""}
                </div>
                <span style={{ fontSize: 13, color: step.done ? C.ink : C.muted }}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CARD STACK ──────────────────────────────────────────────────────── */}
      {phase === "cards" && job && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: -0.5 }}>Role<span style={{ color: C.accent }}>Call</span></span>
            <span style={{ fontSize: 12, color: C.muted }}>{cardIndex + 1} / {jobs.length}</span>
            <button onClick={() => setPhase("matches")} style={{ fontSize: 13, color: C.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              Saved ({liked.length}) →
            </button>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative" }}>
            {jobs[cardIndex + 1] && <div style={{ position: "absolute", width: "min(390px,93vw)", height: 540, background: C.cardAlt, borderRadius: 20, border: `1px solid ${C.border}`, transform: "scale(0.94) translateY(18px)", zIndex: 1 }} />}
            {jobs[cardIndex + 2] && <div style={{ position: "absolute", width: "min(390px,93vw)", height: 540, background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, transform: "scale(0.88) translateY(36px)", zIndex: 0 }} />}

            <div
              className={`card-flip${swipeAnim ? ` swipe-${swipeAnim}` : ""}`}
              style={{ width: "min(390px,93vw)", zIndex: 2, position: "relative", userSelect: "none" }}
              onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            >
              <div style={{ transform: `translateX(${dragX}px) rotate(${dragRot}deg)`, transition: dragState.dragging ? "none" : "transform 0.3s" }}>
                {dragState.x > 30 && <div style={{ position: "absolute", top: 24, left: 20, zIndex: 10, border: `2px solid ${C.like}`, color: C.like, borderRadius: 6, padding: "4px 12px", fontWeight: 800, fontSize: 16, opacity: Math.min(dragState.x / 100, 1), transform: "rotate(-6deg)", fontFamily: "'Syne',sans-serif" }}>SAVE</div>}
                {dragState.x < -30 && <div style={{ position: "absolute", top: 24, right: 20, zIndex: 10, border: `2px solid ${C.pass}`, color: C.pass, borderRadius: 6, padding: "4px 12px", fontWeight: 800, fontSize: 16, opacity: Math.min(-dragState.x / 100, 1), transform: "rotate(6deg)", fontFamily: "'Syne',sans-serif" }}>PASS</div>}

                <div className={`card-inner${flipped ? " flipped" : ""}`} style={{ width: "100%", height: 540 }}>
                  {/* Front */}
                  <div className="card-face" style={{ position: "absolute", width: "100%", height: "100%", background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ height: 4, background: job.wildcard ? `linear-gradient(90deg, ${C.pass}, ${C.accent})` : `linear-gradient(90deg, ${C.accent}, #b8ff00)` }} />
                    <div style={{ padding: "26px 26px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
                      {job.wildcard && (
                        <div style={{ alignSelf: "flex-start", background: "rgba(255,77,77,0.1)", color: C.pass, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "4px 10px", borderRadius: 100, marginBottom: 14, border: `1px solid rgba(255,77,77,0.2)` }}>
                          ✦ Wildcard
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 21, fontWeight: 700, lineHeight: 1.2, color: C.ink }}>{job.title}</div>
                          <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>{job.company}</div>
                        </div>
                        <div style={{ background: C.accentDim, border: `1px solid ${C.accent}`, borderRadius: 10, padding: "8px 12px", textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>{job.match}%</div>
                          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>match</div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 16, marginBottom: 18, fontSize: 12, color: C.muted }}>
                        <span>📍 {job.location}</span>
                        <span>💰 {job.salary}</span>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                        {(job.tags || []).map(t => (
                          <span key={t} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "#1a1a1a", color: C.muted, border: `1px solid ${C.border}` }}>{t}</span>
                        ))}
                      </div>

                      <div style={{ background: "#0f1a00", border: `1px solid rgba(232,255,71,0.15)`, borderRadius: 12, padding: "14px 16px", marginBottom: 18, flex: 1 }}>
                        <div style={{ fontSize: 9, letterSpacing: 2, color: C.accent, textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>Why it fits</div>
                        <p style={{ fontSize: 13, color: "#c8d4a0", lineHeight: 1.6 }}>{job.why}</p>
                      </div>

                      <button onClick={e => { e.stopPropagation(); setFlipped(true); }} style={{ background: "none", border: "none", fontSize: 12, color: C.accent, cursor: "pointer", fontWeight: 600, letterSpacing: 0.5, textAlign: "left" }}>
                        See details & apply →
                      </button>
                    </div>
                  </div>

                  {/* Back */}
                  <div className="card-face card-back-face" style={{ position: "absolute", width: "100%", height: "100%", background: "#0d1a00", borderRadius: 20, border: `1px solid rgba(232,255,71,0.2)`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "24px 26px", flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
                      <button onClick={e => { e.stopPropagation(); setFlipped(false); }} style={{ alignSelf: "flex-start", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, marginBottom: 18 }}>← Back</button>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{job.title}</div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 22 }}>{job.company} · {job.location}</div>

                      <div style={{ fontSize: 10, letterSpacing: 2, color: C.accent, textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>Highlights</div>
                      {(job.highlights || []).map((h, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                          <span style={{ color: C.accent, flexShrink: 0 }}>◆</span>
                          <span style={{ fontSize: 13, color: "#c8d4a0", lineHeight: 1.5 }}>{h}</span>
                        </div>
                      ))}

                      <div style={{ marginTop: "auto", paddingTop: 20, borderTop: `1px solid rgba(232,255,71,0.1)` }}>
                        <div style={{ fontSize: 10, letterSpacing: 2, color: C.accent, textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>Where to apply</div>
                        <div style={{ fontSize: 13, color: "#c8d4a0", marginBottom: 4 }}>{job.where_to_apply}</div>
                        {job.deadline_hint && <div style={{ fontSize: 12, color: C.muted }}>⏰ {job.deadline_hint}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 20, marginTop: 32, alignItems: "center" }}>
              <button onClick={() => doSwipe("left")} style={{ width: 60, height: 60, borderRadius: "50%", background: "transparent", border: `2px solid ${C.pass}`, color: C.pass, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              <button onClick={() => doSwipe("right")} style={{ width: 72, height: 72, borderRadius: "50%", background: C.like, border: "none", color: C.bg, fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>♥</button>
            </div>
            <p style={{ fontSize: 11, color: "#333", marginTop: 12 }}>Drag or use buttons</p>
          </div>
        </div>
      )}

      {/* ── DONE ────────────────────────────────────────────────────────────── */}
      {(phase === "done" || (phase === "cards" && !job)) && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 20, padding: 40, textAlign: "center" }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 48, fontWeight: 800 }}>Done.</div>
          <p style={{ color: C.muted, fontSize: 15 }}>You saved {liked.length} of {jobs.length} roles</p>
          <button onClick={() => setPhase("matches")} style={{ background: C.accent, color: C.bg, border: "none", borderRadius: 100, padding: "14px 40px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Syne',sans-serif" }}>
            View Saved Roles →
          </button>
        </div>
      )}

      {/* ── MATCHES ─────────────────────────────────────────────────────────── */}
      {phase === "matches" && (
        <div style={{ minHeight: "100vh" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18 }}>Role<span style={{ color: C.accent }}>Call</span></span>
            <button onClick={() => setPhase("cards")} style={{ fontSize: 13, color: C.accent, background: "none", border: "none", cursor: "pointer" }}>← Keep swiping</button>
          </div>

          <div style={{ padding: "36px 24px", maxWidth: 560, margin: "0 auto" }}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: C.accent, textTransform: "uppercase", marginBottom: 8, fontFamily: "'Syne',sans-serif" }}>Saved Roles</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 8 }}>{liked.length} {liked.length === 1 ? "Match" : "Matches"}</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32 }}>Tap any role to take action</p>

            {liked.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🃏</div>
                <p>No saved roles yet. Go back and swipe right!</p>
              </div>
            )}

            {liked.map((j, i) => (
              <div key={j.id || i} onClick={() => { setActionJob(j); setActionMode(null); setActionContent(""); }} className="fade-up" style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                padding: "18px 20px", marginBottom: 12, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 14,
                animationDelay: `${i * 0.05}s`, transition: "border-color 0.15s"
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ background: C.accentDim, border: `1px solid ${C.accent}`, borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 15, color: C.accent, flexShrink: 0, fontFamily: "'Syne',sans-serif" }}>
                  {j.match}%
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.title}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{j.company} · {j.location}</div>
                </div>
                {j.wildcard && <span style={{ color: C.pass, fontSize: 14 }}>✦</span>}
                <span style={{ color: C.accent }}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ACTION MODAL ────────────────────────────────────────────────────── */}
      {actionJob && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(6px)" }}
          onClick={() => { if (!actionMode) { setActionJob(null); } }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0f0f0f", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 580,
            padding: "28px 24px 48px", border: `1px solid ${C.border}`, borderBottom: "none",
            maxHeight: "85vh", overflowY: "auto"
          }}>
            <div style={{ width: 36, height: 3, background: C.border, borderRadius: 2, margin: "0 auto 24px" }} />

            {/* Job info */}
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{actionJob.title}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>{actionJob.company} · {actionJob.salary}</div>

            {/* Action selection */}
            {!actionMode && (
              <>
                <div style={{ fontSize: 10, letterSpacing: 3, color: C.accent, textTransform: "uppercase", marginBottom: 20, fontFamily: "'Syne',sans-serif" }}>What do you want to do?</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <ActionCard icon="✍️" label="Cover Letter" desc="AI writes from your resume" onClick={() => openAction(actionJob, "cover")} />
                  <ActionCard icon="✅" label="Checklist" desc="Step-by-step action plan" onClick={() => openAction(actionJob, "checklist")} />
                  <ActionCard icon="🔗" label="Apply Now" desc="Go to the listing" onClick={() => window.open(actionJob.where_to_apply, "_blank")} />
                  <ActionCard icon="📅" label="Add Deadline" desc="Copy to your calendar" onClick={() => { alert(`Deadline: ${actionJob.deadline_hint || "Not listed — apply soon!"}`); }} />
                </div>
                <button onClick={() => setActionJob(null)} style={{ width: "100%", marginTop: 16, padding: "13px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 100, cursor: "pointer", fontSize: 14, color: C.muted, fontFamily: "'DM Sans',sans-serif" }}>Close</button>
              </>
            )}

            {/* Cover letter output */}
            {actionMode === "cover" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: 3, color: C.accent, textTransform: "uppercase", fontFamily: "'Syne',sans-serif" }}>Cover Letter</div>
                  <button onClick={() => setActionMode(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13 }}>← Back</button>
                </div>
                {actionLoading ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
                    <div style={{ width: 32, height: 32, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 16px" }} />
                    Writing your cover letter…
                  </div>
                ) : (
                  <>
                    <textarea readOnly value={actionContent} rows={14} style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.7, color: "#c8d4a0", background: "#0a0a0a" }} />
                    <button onClick={() => { navigator.clipboard.writeText(actionContent); }} style={{ width: "100%", padding: "13px", background: C.accent, color: C.bg, border: "none", borderRadius: 100, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>
                      Copy to Clipboard
                    </button>
                  </>
                )}
              </>
            )}

            {/* Checklist output */}
            {actionMode === "checklist" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: 3, color: C.accent, textTransform: "uppercase", fontFamily: "'Syne',sans-serif" }}>Application Checklist</div>
                  <button onClick={() => setActionMode(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13 }}>← Back</button>
                </div>
                {actionLoading ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
                    <div style={{ width: 32, height: 32, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 16px" }} />
                    Building your checklist…
                  </div>
                ) : actionContent && typeof actionContent === "object" ? (
                  <>
                    {actionContent.insider_tip && (
                      <div style={{ background: "#0f1a00", border: `1px solid rgba(232,255,71,0.15)`, borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "#c8d4a0", lineHeight: 1.6 }}>
                        💡 {actionContent.insider_tip}
                      </div>
                    )}
                    {(actionContent.checklist || []).map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${item.priority === "high" ? C.accent : C.border}`, flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <div style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{item.item}</div>
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{item.note}</div>
                        </div>
                      </div>
                    ))}
                    {actionContent.timeline && (
                      <div style={{ fontSize: 12, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 14, marginTop: 8 }}>
                        ⏰ {actionContent.timeline}
                      </div>
                    )}
                  </>
                ) : <p style={{ color: C.muted, fontSize: 13 }}>{String(actionContent)}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionCard({ icon, label, desc, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "#111", border: `1px solid ${C.border}`, borderRadius: 14,
      padding: "18px 16px", cursor: "pointer", textAlign: "left",
      fontFamily: "'DM Sans',sans-serif", transition: "border-color 0.15s, transform 0.15s"
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{desc}</div>
    </button>
  );
}
