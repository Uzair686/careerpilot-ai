"""
CareerPilot AI — Resume Parser
Extracts text from PDF/DOCX/TXT and runs NLP skill analysis.
Author: Muhammad Uzair
"""

import re
import os

# ── Expanded Skill Database ─────────────────────────────────────────────────
SKILL_DATABASE = {
    # Languages
    "python": 10, "java": 8, "javascript": 9, "typescript": 8,
    "c++": 8, "c#": 7, "php": 6, "ruby": 6, "go": 8, "rust": 7, "swift": 7, "kotlin": 7, "r": 7,
    # Web / Frontend
    "react": 9, "vue": 7, "angular": 7, "next.js": 9, "html": 6, "css": 6,
    "tailwind": 7, "bootstrap": 5, "sass": 5, "webpack": 6, "graphql": 8,
    # Backend / API
    "django": 9, "flask": 8, "fastapi": 8, "node": 7, "express": 7, "rest api": 7,
    # Data / AI / ML
    "machine learning": 10, "deep learning": 10, "ai": 10, "nlp": 9,
    "tensorflow": 9, "pytorch": 9, "scikit-learn": 8, "pandas": 7, "numpy": 7,
    "data science": 9, "computer vision": 9, "llm": 10, "openai": 8,
    # Databases
    "sql": 8, "postgresql": 8, "mysql": 7, "mongodb": 7, "redis": 7, "sqlite": 5,
    "elasticsearch": 7, "firebase": 6,
    # DevOps / Cloud
    "docker": 8, "kubernetes": 9, "aws": 9, "azure": 8, "gcp": 8, "linux": 7,
    "ci/cd": 7, "git": 6, "github": 6, "gitlab": 6, "terraform": 7,
    # Mobile
    "flutter": 7, "react native": 8, "android": 7, "ios": 7,
    # Tools / Other
    "figma": 6, "agile": 6, "scrum": 5, "jira": 5, "power bi": 7, "tableau": 7,
    "excel": 5, "matlab": 6,
}

SKILL_CATEGORIES = {
    "AI/ML": ["machine learning","deep learning","ai","nlp","tensorflow","pytorch",
               "scikit-learn","data science","computer vision","llm","openai"],
    "Frontend": ["react","vue","angular","next.js","javascript","typescript","html","css","tailwind"],
    "Backend":  ["python","django","flask","fastapi","node","java","php","ruby","go","rest api"],
    "Database": ["sql","postgresql","mysql","mongodb","redis","elasticsearch","firebase"],
    "DevOps":   ["docker","kubernetes","aws","azure","gcp","linux","ci/cd","git","terraform"],
    "Mobile":   ["flutter","react native","android","ios","swift","kotlin"],
}


def extract_text(file_path: str) -> str:
    """Auto-detect file type and extract plain text."""
    ext = file_path.rsplit(".", 1)[-1].lower()

    if ext == "txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    if ext == "pdf":
        return _extract_pdf(file_path)

    if ext in ("docx", "doc"):
        return _extract_docx(file_path)

    raise ValueError(f"Unsupported file extension: .{ext}")


def _extract_pdf(path: str) -> str:
    try:
        import PyPDF2
        text = ""
        with open(path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n"
        return text
    except ImportError:
        raise RuntimeError("PyPDF2 not installed. Run: pip install PyPDF2")


def _extract_docx(path: str) -> str:
    try:
        from docx import Document
        doc = Document(path)
        return "\n".join(p.text for p in doc.paragraphs)
    except ImportError:
        raise RuntimeError("python-docx not installed. Run: pip install python-docx")


def extract_skills(text: str) -> list:
    text_lower = text.lower()
    found = []
    for skill in SKILL_DATABASE:
        pattern = r"\b" + re.escape(skill) + r"\b"
        if re.search(pattern, text_lower):
            found.append(skill)
    return found


def calculate_score(skills: list) -> int:
    if not skills:
        return 5
    raw = sum(SKILL_DATABASE.get(s, 5) for s in skills)
    return min(raw * 2, 100)


def get_score_label(score: int) -> str:
    if score >= 85:  return "Excellent"
    if score >= 70:  return "Good"
    if score >= 50:  return "Needs Improvement"
    return "Beginner"


def categorize_skills(skills: list) -> dict:
    cats = {}
    for cat, members in SKILL_CATEGORIES.items():
        found = [s for s in skills if s in members]
        if found:
            cats[cat] = found
    return cats


def extract_meta(text: str) -> dict:
    return {
        "has_email":    bool(re.search(r"[\w.\-]+@[\w.\-]+\.\w+", text)),
        "has_phone":    bool(re.search(r"\+?\d[\d\s\-(). ]{7,}\d", text)),
        "has_linkedin": bool(re.search(r"linkedin", text, re.I)),
        "has_github":   bool(re.search(r"github", text, re.I)),
        "word_count":   len(text.split()),
    }


def analyze_resume(text: str) -> dict:
    skills  = extract_skills(text)
    score   = calculate_score(skills)
    all_s   = set(SKILL_DATABASE.keys())
    missing = sorted(list(all_s - set(skills)),
                     key=lambda s: SKILL_DATABASE[s], reverse=True)[:8]
    meta    = extract_meta(text)
    cats    = categorize_skills(skills)

    return {
        "skills":          skills,
        "score":           score,
        "score_label":     get_score_label(score),
        "missing_skills":  missing,
        "categories":      cats,
        "meta":            meta,
        "recommendation":  _generate_recommendation(score, skills, missing, meta),
        "strengths":       _generate_strengths(skills, cats),
        "action_items":    _generate_action_items(score, missing, meta),
    }


def _generate_recommendation(score, skills, missing, meta) -> str:
    if score >= 85:
        return "Outstanding profile. You qualify for senior and leadership roles. Focus on system design, architecture, and showcasing measurable impact."
    if score >= 70:
        return "Strong profile. You are competitive for mid-to-senior roles. Strengthen your top 2 missing skills and add quantified achievements."
    if score >= 50:
        return "Solid foundation. Target junior-to-mid roles. Build 2–3 portfolio projects and learn one in-demand framework or cloud platform."
    return "Early-stage profile. Focus on learning one core language deeply, complete a certification, and build your first 2 GitHub projects."


def _generate_strengths(skills, cats) -> list:
    strengths = []
    if cats.get("AI/ML"):
        strengths.append(f"Strong AI/ML background ({', '.join(cats['AI/ML'][:3])})")
    if cats.get("Frontend") and cats.get("Backend"):
        strengths.append("Full-stack capability across frontend and backend")
    if cats.get("DevOps"):
        strengths.append(f"Cloud/DevOps experience ({', '.join(cats['DevOps'][:3])})")
    if len(skills) >= 10:
        strengths.append(f"Broad technical skill set ({len(skills)} skills detected)")
    if not strengths:
        strengths.append("Technical foundation in place — ready to expand expertise")
    return strengths


def _generate_action_items(score, missing, meta) -> list:
    items = []
    if not meta["has_linkedin"]:
        items.append("Add your LinkedIn profile URL to the resume")
    if not meta["has_github"]:
        items.append("Add your GitHub profile URL to showcase projects")
    if missing:
        items.append(f"Learn '{missing[0]}' — the highest-demand skill you're missing")
    if score < 70:
        items.append("Add 2–3 quantified project achievements (e.g. 'reduced load time by 40%')")
    items.append("Tailor your resume keywords to each specific job description")
    return items[:5]