"""
CareerPilot AI — Professional PDF Report Generator
Produces a real consultancy-grade report using ReportLab.
Author: Muhammad Uzair
"""

import os
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, KeepTogether
    )
    from reportlab.graphics.shapes import Drawing, Rect, String
    from reportlab.graphics import renderPDF
    REPORTLAB_OK = True
except ImportError:
    REPORTLAB_OK = False


# ── Color Palette ─────────────────────────────────────────────────────────────
C_NAVY    = colors.HexColor("#0b1426")
C_BLUE    = colors.HexColor("#1e4fc2")
C_SKY     = colors.HexColor("#5b9cf6")
C_MINT    = colors.HexColor("#10b981")
C_AMBER   = colors.HexColor("#f59e0b")
C_ROSE    = colors.HexColor("#ef4444")
C_GRAY1   = colors.HexColor("#f8fafc")
C_GRAY2   = colors.HexColor("#e2e8f0")
C_GRAY3   = colors.HexColor("#94a3b8")
C_DARK    = colors.HexColor("#1e293b")
C_TEXT    = colors.HexColor("#334155")
C_WHITE   = colors.white


def generate_report(filename: str, data: dict) -> str:
    """Generate a PDF report and return the file path."""
    out_dir  = os.path.join(os.path.dirname(__file__), "../uploads")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "resume_report.pdf")

    if not REPORTLAB_OK:
        _fallback_txt(out_path.replace(".pdf", ".txt"), data)
        return out_path.replace(".pdf", ".txt")

    _build_pdf(out_path, data)
    return out_path


# ── PDF Builder ───────────────────────────────────────────────────────────────

def _build_pdf(path: str, data: dict):
    W, H = A4   # 210 × 297 mm

    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=14*mm,  bottomMargin=16*mm,
    )

    styles = _build_styles()
    story  = []

    # ── HEADER ──────────────────────────────────────────────────────────
    now     = datetime.now()
    date_s  = now.strftime("%B %d, %Y")
    rid     = f"CPR-{now.strftime('%Y%m%d')}-{id(data) & 0xFFFF:04X}"
    score   = data.get("score", 0)
    label   = data.get("score_label", "N/A")
    skills  = data.get("skills", [])
    missing = data.get("missing_skills", [])
    rec     = data.get("recommendation", "")
    cats    = data.get("categories", {})
    actions = data.get("action_items", [])
    strengths = data.get("strengths", [])
    meta    = data.get("meta", {})

    score_color = C_MINT if score >= 70 else C_AMBER if score >= 50 else C_ROSE

    # Header block
    header_data = [[
        Paragraph('<font color="#5b9cf6" size="22"><b>CareerPilot AI</b></font><br/>'
                  '<font color="#94a3b8" size="9">AI Career Intelligence Platform</font>',
                  styles["left"]),
        Paragraph(f'<font color="#94a3b8" size="8">Report ID: {rid}<br/>'
                  f'Generated: {date_s}<br/>'
                  f'Developed by: <b>Muhammad Uzair</b></font>',
                  styles["right"]),
    ]]
    header_tbl = Table(header_data, colWidths=[100*mm, 74*mm])
    header_tbl.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,-1), C_NAVY),
        ("TOPPADDING",  (0,0), (-1,-1), 10),
        ("BOTTOMPADDING",(0,0), (-1,-1), 10),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING",(0,0), (-1,-1), 8),
        ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 6*mm))

    # Title line
    story.append(Paragraph("RESUME INTELLIGENCE REPORT", styles["main_title"]))
    story.append(HRFlowable(width="100%", thickness=2, color=C_BLUE, spaceAfter=5*mm))

    # ── SECTION 1: PERFORMANCE OVERVIEW ─────────────────────────────────
    story.append(_section_header("01  CANDIDATE PERFORMANCE OVERVIEW", styles))

    # Score + status card
    grade = "A" if score >= 85 else "B+" if score >= 75 else "B" if score >= 65 else "C+" if score >= 55 else "C" if score >= 45 else "D"
    status_icon = "✅" if score >= 70 else "⚠️" if score >= 50 else "❌"

    overview_data = [
        [
            Paragraph(f'<font color="{score_color.hexval()}" size="48"><b>{score}</b></font><br/>'
                      f'<font color="#94a3b8" size="10">out of 100</font>',
                      styles["center"]),
            Table([
                [Paragraph(f'<b>Grade</b>', styles["kv_label"]),
                 Paragraph(f'<font color="{score_color.hexval()}"><b>{grade}</b></font>', styles["kv_val"])],
                [Paragraph('<b>Status</b>', styles["kv_label"]),
                 Paragraph(f'{status_icon} {label}', styles["kv_val"])],
                [Paragraph('<b>Skills Found</b>', styles["kv_label"]),
                 Paragraph(f'<b>{len(skills)}</b> skills detected', styles["kv_val"])],
                [Paragraph('<b>Skills Missing</b>', styles["kv_label"]),
                 Paragraph(f'<b>{len(missing)}</b> high-value gaps', styles["kv_val"])],
                [Paragraph('<b>LinkedIn</b>', styles["kv_label"]),
                 Paragraph("✓ Present" if meta.get("has_linkedin") else "✗ Missing", styles["kv_val"])],
                [Paragraph('<b>GitHub</b>', styles["kv_label"]),
                 Paragraph("✓ Present" if meta.get("has_github") else "✗ Missing", styles["kv_val"])],
            ], colWidths=[32*mm, 60*mm],
               style=TableStyle([
                   ("FONTSIZE", (0,0), (-1,-1), 9),
                   ("TEXTCOLOR",(0,0), (0,-1), C_GRAY3),
                   ("TEXTCOLOR",(1,0), (1,-1), C_DARK),
                   ("TOPPADDING",(0,0),(-1,-1), 3),
                   ("BOTTOMPADDING",(0,0),(-1,-1), 3),
               ])),
        ]
    ]
    ov_tbl = Table(overview_data, colWidths=[40*mm, 134*mm])
    ov_tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), C_GRAY1),
        ("BOX",          (0,0), (-1,-1), 1, C_GRAY2),
        ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING",   (0,0), (-1,-1), 8),
        ("BOTTOMPADDING",(0,0), (-1,-1), 8),
    ]))
    story.append(ov_tbl)
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph(f"<b>Overall Assessment:</b> {rec}", styles["body"]))
    story.append(Spacer(1, 5*mm))

    # ── SECTION 2: SKILLS ANALYSIS ───────────────────────────────────────
    story.append(_section_header("02  SKILLS ANALYSIS", styles))

    if skills:
        # By category
        if cats:
            cat_rows = []
            for cat_name, cat_skills in cats.items():
                cat_rows.append([
                    Paragraph(f"<b>{cat_name}</b>", styles["small_bold"]),
                    Paragraph(", ".join(s.upper() for s in cat_skills), styles["small"]),
                ])
            cat_tbl = Table(cat_rows, colWidths=[35*mm, 139*mm])
            cat_tbl.setStyle(TableStyle([
                ("BACKGROUND",   (0,0), (0,-1), C_NAVY),
                ("TEXTCOLOR",    (0,0), (0,-1), C_SKY),
                ("BACKGROUND",   (1,0), (1,-1), C_GRAY1),
                ("TEXTCOLOR",    (1,0), (1,-1), C_TEXT),
                ("GRID",         (0,0), (-1,-1), 0.5, C_GRAY2),
                ("TOPPADDING",   (0,0), (-1,-1), 5),
                ("BOTTOMPADDING",(0,0), (-1,-1), 5),
                ("LEFTPADDING",  (0,0), (-1,-1), 7),
                ("FONTSIZE",     (0,0), (-1,-1), 9),
            ]))
            story.append(cat_tbl)
        else:
            story.append(Paragraph(", ".join(s.upper() for s in skills), styles["body"]))
    else:
        story.append(Paragraph("No skills detected. Ensure the resume contains technical keywords.", styles["warn"]))

    story.append(Spacer(1, 5*mm))

    # Skill score bar
    if skills:
        story.append(Paragraph("<b>Score Breakdown by Category</b>", styles["small_bold"]))
        story.append(Spacer(1, 2*mm))
        cat_scores = _compute_cat_scores(skills, cats)
        bar_rows = [[
            Paragraph(cat, styles["small"]),
            _bar_drawing(pct),
            Paragraph(f"{pct}%", styles["small_bold"]),
        ] for cat, pct in cat_scores.items()]
        if bar_rows:
            bar_tbl = Table(bar_rows, colWidths=[38*mm, 118*mm, 18*mm])
            bar_tbl.setStyle(TableStyle([
                ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                ("TOPPADDING", (0,0), (-1,-1), 3),
                ("BOTTOMPADDING", (0,0), (-1,-1), 3),
            ]))
            story.append(bar_tbl)

    story.append(Spacer(1, 5*mm))

    # ── SECTION 3: SKILL GAP ────────────────────────────────────────────
    story.append(_section_header("03  SKILL GAP ANALYSIS", styles))

    if missing:
        gap_header = [
            [Paragraph("<b>#</b>", styles["th"]),
             Paragraph("<b>Missing Skill</b>", styles["th"]),
             Paragraph("<b>Demand Level</b>", styles["th"]),
             Paragraph("<b>Est. Time to Learn</b>", styles["th"])],
        ]
        timelines = {
            "machine learning":"8–12 weeks","docker":"2–3 weeks","react":"6–8 weeks",
            "kubernetes":"4–6 weeks","typescript":"2–3 weeks","aws":"6–10 weeks",
            "postgresql":"2–3 weeks","tensorflow":"8–10 weeks","next.js":"3–4 weeks",
            "graphql":"2–3 weeks","flutter":"6–8 weeks","redis":"1–2 weeks",
            "python":"4–6 weeks","sql":"3–4 weeks","linux":"3–4 weeks",
        }
        demand_map = {10:"🔴 Critical", 9:"🟠 Very High", 8:"🟡 High", 7:"🟢 Medium", 6:"⚪ Standard"}
        from resume_parser import SKILL_DATABASE
        gap_rows = []
        for i, skill in enumerate(missing[:8], 1):
            d = SKILL_DATABASE.get(skill, 5)
            dem = demand_map.get(d, "⚪ Standard")
            t   = timelines.get(skill, "3–5 weeks")
            gap_rows.append([
                Paragraph(str(i), styles["td_center"]),
                Paragraph(f"<b>{skill.upper()}</b>", styles["td"]),
                Paragraph(dem, styles["td"]),
                Paragraph(t, styles["td"]),
            ])
        gap_tbl = Table(gap_header + gap_rows, colWidths=[10*mm, 60*mm, 52*mm, 52*mm])
        gap_tbl.setStyle(TableStyle([
            ("BACKGROUND",   (0,0), (-1,0), C_NAVY),
            ("TEXTCOLOR",    (0,0), (-1,0), C_WHITE),
            ("BACKGROUND",   (0,1), (-1,-1), C_GRAY1),
            ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY1, C_WHITE]),
            ("GRID",         (0,0), (-1,-1), 0.5, C_GRAY2),
            ("TOPPADDING",   (0,0), (-1,-1), 5),
            ("BOTTOMPADDING",(0,0), (-1,-1), 5),
            ("LEFTPADDING",  (0,0), (-1,-1), 6),
            ("FONTSIZE",     (0,0), (-1,-1), 9),
            ("ALIGN",        (0,0), (0,-1), "CENTER"),
        ]))
        story.append(gap_tbl)
    else:
        story.append(Paragraph("✅ No critical skill gaps detected. Continue deepening expertise.", styles["body"]))

    story.append(Spacer(1, 5*mm))

    # ── SECTION 4: CAREER RECOMMENDATIONS ────────────────────────────────
    story.append(_section_header("04  CAREER RECOMMENDATIONS", styles))

    if strengths:
        story.append(Paragraph("<b>Your Strengths:</b>", styles["small_bold"]))
        for s in strengths:
            story.append(Paragraph(f"✅  {s}", styles["bullet"]))
        story.append(Spacer(1, 3*mm))

    # Role suggestions
    role_map = [
        (["machine learning","ai","deep learning","tensorflow","pytorch"],
         "AI/ML Engineer", "PKR 200K–800K/month", "$50–200/hr"),
        (["react","javascript","typescript","next.js"],
         "Senior Frontend Engineer", "PKR 120K–350K/month", "$40–90/hr"),
        (["python","django","flask","fastapi"],
         "Backend/API Engineer", "PKR 100K–400K/month", "$35–100/hr"),
        (["docker","kubernetes","aws","azure"],
         "Cloud/DevOps Engineer", "PKR 150K–600K/month", "$50–130/hr"),
        (["data science","sql","pandas","tableau"],
         "Data Analyst / Scientist", "PKR 120K–400K/month", "$40–90/hr"),
    ]
    matched_roles = []
    for skill_set, title, pkr, usd in role_map:
        if any(s in skills for s in skill_set):
            matched_roles.append((title, pkr, usd))

    if not matched_roles:
        matched_roles = [("Junior Software Developer", "PKR 60K–150K/month", "$15–40/hr")]

    role_header = [[
        Paragraph("<b>Recommended Role</b>", styles["th"]),
        Paragraph("<b>Pakistan Salary</b>", styles["th"]),
        Paragraph("<b>Remote Rate</b>", styles["th"]),
    ]]
    role_rows = [[
        Paragraph(f"<b>{r[0]}</b>", styles["td"]),
        Paragraph(r[1], styles["td"]),
        Paragraph(r[2], styles["td"]),
    ] for r in matched_roles[:4]]

    role_tbl = Table(role_header + role_rows, colWidths=[72*mm, 62*mm, 40*mm])
    role_tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,0), C_BLUE),
        ("TEXTCOLOR",    (0,0), (-1,0), C_WHITE),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY1, C_WHITE]),
        ("GRID",         (0,0), (-1,-1), 0.5, C_GRAY2),
        ("TOPPADDING",   (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0), (-1,-1), 6),
        ("LEFTPADDING",  (0,0), (-1,-1), 7),
        ("FONTSIZE",     (0,0), (-1,-1), 9),
    ]))
    story.append(role_tbl)
    story.append(Spacer(1, 5*mm))

    # ── SECTION 5: INTERVIEW PREPARATION ─────────────────────────────────
    story.append(_section_header("05  INTERVIEW PREPARATION GUIDE", styles))

    int_sections = [
        ("Technical Focus Areas", [
            f"Deep-dive your strongest skills: {', '.join(skills[:4]) or 'core languages'}",
            "Practice explaining your projects to non-technical audiences",
            "Solve 2 LeetCode problems daily (Easy → Medium → Hard)",
            "Review system design basics: load balancers, caches, databases",
        ]),
        ("Behavioral Preparation (STAR Method)", [
            "Prepare 5 stories: challenge overcome, team conflict, leadership, failure, achievement",
            "Structure: Situation → Task → Action → Result (always end with a metric)",
            "Record yourself answering — judges tone, clarity, confidence",
        ]),
        ("Day-of Interview Tips", [
            "Research the company's product, tech stack, and recent news",
            "Prepare 3 insightful questions to ask the interviewer",
            "Arrive/connect 5 minutes early; have your resume PDF open",
            "After the interview: send a thank-you email within 24 hours",
        ]),
    ]

    for title, bullets in int_sections:
        story.append(Paragraph(f"<b>{title}</b>", styles["small_bold"]))
        for b in bullets:
            story.append(Paragraph(f"▸  {b}", styles["bullet"]))
        story.append(Spacer(1, 3*mm))

    # ── SECTION 6: 30-DAY ACTION PLAN ────────────────────────────────────
    story.append(_section_header("06  YOUR 30-DAY ACTION PLAN", styles))

    plan = [
        ("Week 1", "Quick Wins",
         ["Add LinkedIn and GitHub URLs to resume", "Write a 3-line professional summary",
          "Quantify 3 existing achievements on your CV"]),
        ("Week 2", "Skill Building",
         [f"Start learning '{missing[0].upper()}' — use freeCodeCamp or Coursera" if missing else "Deepen expertise in your top skill",
          "Set up a GitHub repo for a new portfolio project"]),
        ("Week 3", "Portfolio & Applications",
         ["Complete and deploy one portfolio project",
          "Apply to 5 jobs with tailored CVs — ATS-match keywords",
          "Request 2 LinkedIn recommendations from colleagues"]),
        ("Week 4", "Interview Readiness",
         ["Practice 10 mock interview questions out loud",
          "Prepare salary negotiation script",
          "Schedule and attend at least 2 interviews"]),
    ]

    plan_rows = []
    for week, title, items in plan:
        plan_rows.append([
            Paragraph(f"<b>{week}</b><br/><font color='#94a3b8' size='8'>{title}</font>",
                      styles["td_center"]),
            Paragraph("<br/>".join(f"□ {it}" for it in items), styles["td"]),
        ])

    plan_tbl = Table(plan_rows, colWidths=[32*mm, 142*mm])
    plan_tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS",(0,0),(-1,-1),[colors.HexColor("#f0f7ff"), C_WHITE]),
        ("GRID",         (0,0), (-1,-1), 0.5, C_GRAY2),
        ("VALIGN",       (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",   (0,0), (-1,-1), 7),
        ("BOTTOMPADDING",(0,0), (-1,-1), 7),
        ("LEFTPADDING",  (0,0), (-1,-1), 7),
        ("FONTSIZE",     (0,0), (-1,-1), 9),
        ("TEXTCOLOR",    (0,0), (0,-1), C_BLUE),
    ]))
    story.append(plan_tbl)
    story.append(Spacer(1, 5*mm))

    # ── FOOTER ──────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=C_GRAY2, spaceBefore=3*mm))
    footer_data = [[
        Paragraph('<font color="#1e4fc2" size="9"><b>CareerPilot AI</b></font> — AI Career Intelligence Platform',
                  styles["left"]),
        Paragraph(f'<font color="#94a3b8" size="8">Muhammad Uzair · Report ID: {rid} · © {now.year}</font>',
                  styles["right"]),
    ]]
    footer_tbl = Table(footer_data, colWidths=[100*mm, 74*mm])
    footer_tbl.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),4)]))
    story.append(footer_tbl)

    doc.build(story)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _section_header(title: str, styles) -> Table:
    tbl = Table([[Paragraph(title, styles["section_title"])]], colWidths=[174*mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), C_NAVY),
        ("TOPPADDING",   (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0), (-1,-1), 6),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
    ]))
    return tbl


def _bar_drawing(pct: int) -> Drawing:
    w, h = 115*mm, 7
    d = Drawing(w, h)
    d.add(Rect(0, 0, w, h, fillColor=C_GRAY2, strokeColor=None))
    fill = C_MINT if pct >= 70 else C_AMBER if pct >= 45 else C_ROSE
    d.add(Rect(0, 0, w * pct / 100, h, fillColor=fill, strokeColor=None))
    return d


def _compute_cat_scores(skills, cats) -> dict:
    from resume_parser import SKILL_DATABASE
    result = {}
    for cat, members in cats.items():
        found = [s for s in members if s in skills]
        if found:
            avg = sum(SKILL_DATABASE.get(s, 5) for s in found) / len(members)
            result[cat] = min(int(avg * 10), 100)
    return result


def _build_styles() -> dict:
    base = getSampleStyleSheet()
    def S(name, **kw):
        return ParagraphStyle(name, parent=base["Normal"], **kw)

    return {
        "main_title":   S("mt", fontSize=16, textColor=C_NAVY, fontName="Helvetica-Bold",
                           alignment=TA_CENTER, spaceAfter=2*mm),
        "section_title":S("st", fontSize=10, textColor=C_SKY, fontName="Helvetica-Bold",
                           alignment=TA_LEFT),
        "body":         S("bd", fontSize=9.5, textColor=C_TEXT, leading=14),
        "bullet":       S("bl", fontSize=9, textColor=C_TEXT, leftIndent=8, leading=13),
        "small":        S("sm", fontSize=8.5, textColor=C_TEXT),
        "small_bold":   S("sb", fontSize=9, textColor=C_DARK, fontName="Helvetica-Bold",
                           spaceAfter=2*mm),
        "warn":         S("wn", fontSize=9, textColor=C_AMBER),
        "center":       S("cn", alignment=TA_CENTER, textColor=C_TEXT, fontSize=9),
        "left":         S("lf", alignment=TA_LEFT, textColor=C_TEXT, fontSize=9),
        "right":        S("rg", alignment=TA_RIGHT, textColor=C_TEXT, fontSize=9),
        "kv_label":     S("kl", fontSize=8.5, textColor=C_GRAY3, fontName="Helvetica-Bold"),
        "kv_val":       S("kv", fontSize=9, textColor=C_DARK),
        "th":           S("th", fontSize=9, textColor=C_WHITE, fontName="Helvetica-Bold"),
        "td":           S("td", fontSize=9, textColor=C_TEXT),
        "td_center":    S("tc", fontSize=9, textColor=C_BLUE, fontName="Helvetica-Bold",
                           alignment=TA_CENTER),
    }


def _fallback_txt(path: str, data: dict):
    """Plain-text fallback if ReportLab not installed."""
    now   = datetime.now()
    score = data.get("score", 0)
    lines = [
        "="*60,
        "    CAREERPILOT AI — RESUME INTELLIGENCE REPORT",
        f"    Generated: {now.strftime('%B %d, %Y at %H:%M')}",
        "="*60, "",
        f"  Score        : {score}/100  [{data.get('score_label','N/A')}]",
        f"  Skills Found : {', '.join(data.get('skills',[]))}",
        f"  Gaps         : {', '.join(data.get('missing_skills',[]))}",
        "", "  Recommendation:", f"  {data.get('recommendation','')}", "",
        "="*60,
        "  CareerPilot AI · Muhammad Uzair",
    ]
    with open(path, "w") as f:
        f.write("\n".join(lines))