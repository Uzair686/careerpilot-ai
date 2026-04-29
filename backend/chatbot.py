"""
CareerPilot AI — Chatbot Module
Uses Anthropic Claude claude-sonnet-4-20250514 with resume context.
Falls back to intelligent local responses if API key is missing.
Author: Muhammad Uzair
"""

import os

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT_TEMPLATE = """You are CareerPilot AI — a world-class professional career coach and resume expert with 15+ years of experience placing candidates at top tech companies globally.

The user has uploaded their resume. Here is the analysis:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Resume Score   : {score}/100 ({score_label})
Skills Found   : {skills}
Missing Skills : {missing}
Recommendation : {recommendation}
LinkedIn       : {linkedin}
GitHub         : {github}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your responsibilities:
1. Give highly specific, actionable career advice based on the user's actual skill set
2. Provide detailed CV/resume improvement suggestions with concrete examples
3. Conduct realistic mock interview sessions (ask questions, evaluate answers)
4. Build personalized learning roadmaps with timelines
5. Advise on salary negotiation tactics with real market data (include Pakistan + remote rates)
6. Write cover letter drafts on request
7. Explain industry trends, in-demand technologies, and company cultures
8. Help with LinkedIn and GitHub profile optimization
9. Answer any career-related question comprehensively — never refuse a relevant question

Rules:
- Always personalize advice to the user's specific skills and score
- Use bullet points, numbered lists, and clear structure in responses
- Be honest but encouraging — highlight strengths before gaps
- When asked for interview questions, actually ask them one at a time and wait for answers
- Include specific salary ranges when discussing compensation (PKR for Pakistan, USD for remote)
- Never give generic advice — always tie back to their resume data
- Answer any question thoroughly — be the smartest career advisor they've ever had
"""

NO_RESUME_PROMPT = """You are CareerPilot AI — a world-class professional career coach and resume expert with 15+ years of experience. You help people with:

1. CV/resume writing and improvement
2. Career path planning and transitions
3. Mock interview preparation (technical, behavioral, system design)
4. Skill gap analysis and learning roadmaps
5. Salary negotiation with real market data (Pakistan + remote/global)
6. Cover letter writing
7. LinkedIn and GitHub profile optimization
8. Job search strategy and networking

Rules:
- Be highly specific and actionable — never give vague advice
- Use bullet points and structured formatting for clarity
- Include real salary figures (PKR for Pakistan, USD for remote/global)
- When conducting mock interviews, ask one question at a time and wait for answers
- Answer any question comprehensively — be genuinely helpful
- For Pakistan-based users, always mention both local and remote earning potential
- No resume has been uploaded yet, so give best-practice general advice
"""


def chatbot_response(user_query: str, resume_data: dict, history: list = []) -> str:
    """
    Route to Anthropic Claude if key available, else use intelligent local fallback.
    """
    if ANTHROPIC_API_KEY:
        return _claude_response(user_query, resume_data, history)
    return _local_response(user_query, resume_data)


# ── Build System Prompt ────────────────────────────────────────────────────

def _build_system_prompt(resume_data: dict) -> str:
    if not resume_data:
        return NO_RESUME_PROMPT
    return SYSTEM_PROMPT_TEMPLATE.format(
        score       = resume_data.get("score", 0),
        score_label = resume_data.get("score_label", "N/A"),
        skills      = ", ".join(resume_data.get("skills", [])) or "None detected",
        missing     = ", ".join(resume_data.get("missing_skills", [])) or "None",
        recommendation = resume_data.get("recommendation", ""),
        linkedin    = "✓ Present" if resume_data.get("meta", {}).get("has_linkedin") else "✗ Missing",
        github      = "✓ Present" if resume_data.get("meta", {}).get("has_github") else "✗ Missing",
    )


# ── Anthropic Claude Path ──────────────────────────────────────────────────

def _claude_response(user_query: str, resume_data: dict, history: list) -> str:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        messages = []

        # Add up to last 14 turns of history
        for turn in history[-14:]:
            if turn.get("role") in ("user", "assistant") and turn.get("content"):
                messages.append({"role": turn["role"], "content": turn["content"]})

        messages.append({"role": "user", "content": user_query})

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1200,
            system=_build_system_prompt(resume_data),
            messages=messages,
        )
        return response.content[0].text.strip()

    except Exception as e:
        # Graceful fallback — never crash the user experience
        return _local_response(user_query, resume_data)


# ── Local Intelligent Fallback ─────────────────────────────────────────────

def _local_response(user_query: str, resume_data: dict) -> str:
    q       = user_query.lower()
    skills  = resume_data.get("skills", [])
    score   = resume_data.get("score", 0)
    missing = resume_data.get("missing_skills", [])
    label   = resume_data.get("score_label", "")
    cats    = resume_data.get("categories", {})
    actions = resume_data.get("action_items", [])

    # ── Career path ──────────────────────────────────────────────────────
    if any(w in q for w in ["career", "path", "role", "field", "job title", "what job"]):
        if cats.get("AI/ML") or any(s in skills for s in ["machine learning","ai","deep learning","nlp"]):
            return (
                "🎯 **Recommended Career Paths for Your Profile**\n\n"
                "Based on your AI/ML skills, here are your best-fit roles:\n\n"
                "1. **ML Engineer** — Build and deploy production ML models\n"
                "   › Avg salary: PKR 200K–600K/month | Remote: $50–120/hr\n\n"
                "2. **AI Research Engineer** — Push state-of-the-art models\n"
                "   › Avg salary: PKR 300K–800K/month | Remote: $80–150/hr\n\n"
                "3. **Data Scientist** — Drive business decisions with data\n"
                "   › Avg salary: PKR 150K–400K/month | Remote: $40–90/hr\n\n"
                "4. **LLM/GenAI Engineer** (🔥 hottest in 2025)\n"
                "   › Avg salary: PKR 400K–1M/month | Remote: $100–200/hr\n\n"
                "**Next Step:** Add LLM/OpenAI API experience to your resume — it's the highest-paying niche right now."
            )
        if cats.get("Frontend") or any(s in skills for s in ["react","vue","angular","javascript"]):
            return (
                "🎯 **Recommended Career Paths — Frontend Focus**\n\n"
                "1. **Senior React Developer**\n"
                "   › PKR 150K–350K/month | Remote: $40–90/hr\n\n"
                "2. **Full-Stack Engineer** (add Node.js/Python backend)\n"
                "   › PKR 200K–500K/month | Remote: $60–120/hr\n\n"
                "3. **Frontend Architect** — Design systems & component libraries\n"
                "   › PKR 300K–700K/month | Remote: $80–150/hr\n\n"
                "**Tip:** Next.js expertise is the single most impactful skill to add right now for frontend devs."
            )
        if cats.get("Backend") or any(s in skills for s in ["django","flask","python","java"]):
            return (
                "🎯 **Recommended Career Paths — Backend Focus**\n\n"
                "1. **Backend Engineer** (Python/Java)\n"
                "   › PKR 120K–300K/month | Remote: $35–80/hr\n\n"
                "2. **API/Microservices Architect**\n"
                "   › PKR 250K–600K/month | Remote: $70–130/hr\n\n"
                "3. **Platform Engineer** (add Docker + AWS)\n"
                "   › PKR 200K–500K/month | Remote: $60–120/hr\n\n"
                "**Quick Win:** Adding FastAPI + Docker immediately boosts your market value by 30–40%."
            )
        return (
            "🎯 **Career Path Guidance**\n\n"
            "Upload your resume for personalized recommendations, or tell me your current skills.\n\n"
            "**Top in-demand paths right now:**\n"
            "1. AI/ML Engineering — highest salaries globally\n"
            "2. Full-Stack (React + Python/Node) — most job openings\n"
            "3. Cloud/DevOps (AWS + Kubernetes) — fastest growing\n"
            "4. Cybersecurity — critical shortage, premium pay\n\n"
            "Which area interests you most?"
        )

    # ── Skill gap ────────────────────────────────────────────────────────
    if any(w in q for w in ["gap", "missing", "lack", "need to learn", "what to learn", "roadmap"]):
        if not missing:
            return "✅ Great news — your resume covers most key skills. Focus on deepening expertise and building a strong GitHub portfolio."
        top = missing[:4]
        response = "📈 **Your Personalized Skill Gap Roadmap**\n\n"
        timelines = {"machine learning":"8–12 wks","docker":"2–3 wks","react":"6–8 wks",
                     "kubernetes":"4–6 wks","typescript":"2–3 wks","aws":"6–10 wks",
                     "postgresql":"2–3 wks","tensorflow":"8–10 wks","next.js":"3–4 wks",
                     "graphql":"2–3 wks","flutter":"6–8 wks","redis":"1–2 wks"}
        for i, skill in enumerate(top, 1):
            t = timelines.get(skill, "3–5 wks")
            response += f"**{i}. {skill.upper()}** (⏱ {t})\n"
            response += f"   Resources: freeCodeCamp, Coursera, official docs\n\n"
        if actions:
            response += f"**Immediate Action:** {actions[0]}"
        return response

    # ── CV / Resume improvement ──────────────────────────────────────────
    if any(w in q for w in ["improve", "cv", "resume", "better", "upgrade", "fix", "review"]):
        meta = resume_data.get("meta", {})
        items = []
        if not meta.get("has_linkedin"): items.append("❌ Add LinkedIn profile URL — recruiters check this first")
        if not meta.get("has_github"):   items.append("❌ Add GitHub profile — shows real, working code")
        items += [
            "📌 Quantify every achievement: 'Reduced API latency by 45%' not 'improved performance'",
            "📌 Start each bullet with an action verb: built, led, designed, optimized, launched",
            "📌 Write a 3-line professional summary at the very top",
            "📌 Mirror job description keywords — ATS filters before humans read",
            "📌 Keep to 1 page (under 3 years) or max 2 pages (senior roles)",
            "📌 Remove generic phrases: 'hardworking', 'team player', 'quick learner'",
        ]
        return (
            f"✏️ **CV Improvement Plan** (Score: {score}/100 — {label})\n\n"
            + "\n".join(items[:6])
            + f"\n\n**Top Priority:** {actions[0] if actions else 'Add measurable achievements to every role'}"
        )

    # ── Interview preparation ────────────────────────────────────────────
    if any(w in q for w in ["interview", "prepare", "question", "mock", "practice", "hiring"]):
        tech_qs = []
        if any(s in skills for s in ["python","django","flask"]):
            tech_qs.append("Q: Explain Python's GIL and how it affects multithreading")
        if "react" in skills:
            tech_qs.append("Q: What is the virtual DOM and how does React's reconciliation work?")
        if any(s in skills for s in ["machine learning","ai"]):
            tech_qs.append("Q: Explain overfitting and three techniques to prevent it")
        if "sql" in skills:
            tech_qs.append("Q: What's the difference between INNER JOIN and LEFT JOIN? Write an example.")
        if not tech_qs:
            tech_qs = ["Q: Describe the most complex technical problem you've solved", "Q: How do you approach debugging a production issue?"]

        return (
            "🎯 **Interview Preparation — Personalized for Your Stack**\n\n"
            "**Technical Questions:**\n"
            + "\n".join(f"• {q}" for q in tech_qs[:3])
            + "\n\n**Behavioral Questions (STAR method):**\n"
            "• Tell me about a project you're most proud of — what was your specific contribution?\n"
            "• Describe a time you disagreed with a teammate. How was it resolved?\n"
            "• How do you prioritize when you have 3 urgent tasks and a deadline tomorrow?\n\n"
            "**System Design (if applying to mid/senior):**\n"
            "• Design a URL shortener that handles 1M requests/day\n"
            "• How would you architect a real-time notification system?\n\n"
            "**Your Prep Checklist:**\n"
            "□ Practice 2 LeetCode problems daily (Easy → Medium)\n"
            "□ Prepare 5 STAR stories from your past projects\n"
            "□ Research the company's tech stack before each interview\n"
            "□ Have 3 smart questions ready to ask the interviewer\n\n"
            "Want me to conduct a mock interview right now? Just say 'Start mock interview'."
        )

    # ── Salary ───────────────────────────────────────────────────────────
    if any(w in q for w in ["salary", "pay", "earn", "income", "package", "compensation", "negotiate"]):
        return (
            "💰 **Salary Guide — Pakistan Tech Market 2025**\n\n"
            "**On-site (PKR/month):**\n"
            "• Junior Developer (0–2 yrs):   PKR 60,000 – 120,000\n"
            "• Mid-level (2–5 yrs):          PKR 120,000 – 300,000\n"
            "• Senior Developer (5+ yrs):    PKR 300,000 – 650,000\n"
            "• AI/ML Engineer:               PKR 200,000 – 800,000\n"
            "• Engineering Manager:          PKR 500,000 – 1,200,000\n\n"
            "**Remote (USD/hour):**\n"
            "• Junior:                       $15 – $35\n"
            "• Mid-level:                    $35 – $75\n"
            "• Senior:                       $75 – $130\n"
            "• AI/ML Specialist:             $90 – $200\n\n"
            "**Negotiation Script:**\n"
            "\"Based on my research and X years of experience with [your skills], "
            "I was expecting something in the range of [target + 20%]. Is there flexibility?\"\n\n"
            f"**Your Market Value:** With a score of {score}/100 and skills in "
            f"{', '.join(skills[:3]) or 'your stack'}, you should target "
            f"{'senior rates' if score >= 70 else 'mid-level rates' if score >= 50 else 'junior-to-mid rates'}."
        )

    # ── Cover letter ─────────────────────────────────────────────────────
    if any(w in q for w in ["cover letter", "cover", "application letter"]):
        top_skills = ", ".join(skills[:4]) if skills else "your key skills"
        return (
            "📝 **Cover Letter Template — Customize & Send**\n\n"
            "---\n"
            "Dear [Hiring Manager's Name],\n\n"
            f"I am writing to apply for the [Position] role at [Company]. With expertise in "
            f"{top_skills}, I bring hands-on experience building scalable, production-grade "
            "solutions that deliver measurable results.\n\n"
            "In my most recent role, I [specific achievement with numbers — e.g., 'built a "
            "recommendation engine that increased user engagement by 32%']. I thrive in "
            "[collaborative/fast-paced/remote] environments and am passionate about [relevant "
            "area aligned to company mission].\n\n"
            "I am particularly drawn to [Company] because [specific reason — research their "
            "blog, product, or culture]. I would welcome the opportunity to discuss how my "
            "background can contribute to your team's goals.\n\n"
            "Best regards,\n"
            "[Your Name] | [LinkedIn] | [GitHub] | [Email]\n"
            "---\n\n"
            "**Tips:** Keep it to 250 words max. Customize paragraphs 2 and 3 for each role."
        )

    # ── LinkedIn / GitHub ────────────────────────────────────────────────
    if any(w in q for w in ["linkedin", "github", "portfolio", "profile", "online"]):
        return (
            "🌐 **Online Presence Optimization**\n\n"
            "**LinkedIn Profile Checklist:**\n"
            "□ Professional headshot (7x more profile views)\n"
            "□ Headline: '[Title] | [Skill 1] | [Skill 2] | Open to [type] roles'\n"
            "□ About section: 3 paragraphs — who you are, what you do, what you're seeking\n"
            "□ Every role should have 3–5 bullet achievements with numbers\n"
            "□ Add 5+ skills and get endorsements from colleagues\n"
            "□ Post 1 technical article per week — massive visibility boost\n\n"
            "**GitHub Profile Checklist:**\n"
            "□ Write a README.md for your profile page (github.com/username)\n"
            "□ Pin 6 best repositories to your profile\n"
            "□ Every repo needs: clear README, live demo link, tech stack badge\n"
            "□ Aim for 5+ green commits per week — activity graph matters\n"
            "□ Star and fork relevant repos — signals to recruiters what you follow\n\n"
            "**Portfolio Website (bonus):**\n"
            "Use Vercel + Next.js (free). Include: projects, skills, contact form, resume download."
        )

    # ── Default ──────────────────────────────────────────────────────────
    ctx = f" (Current score: {score}/100 — {label})" if score else ""
    return (
        f"👋 **CareerPilot AI — Your Career Coach**{ctx}\n\n"
        "I can help you with:\n\n"
        "• **CV Analysis & Improvement** — specific, actionable edits\n"
        "• **Career Path Planning** — personalized role recommendations\n"
        "• **Skill Gap Roadmap** — what to learn and in what order\n"
        "• **Mock Interviews** — technical, behavioral, and system design\n"
        "• **Salary Negotiation** — real market data for Pakistan & remote\n"
        "• **Cover Letter Writing** — ready-to-customize templates\n"
        "• **LinkedIn & GitHub Optimization** — get noticed by recruiters\n\n"
        "What would you like help with today?"
    )