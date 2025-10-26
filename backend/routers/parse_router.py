from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import List, Any
import pdfplumber, re
from dateutil import parser as dparse
from datetime import datetime

router = APIRouter()

DAY_RE = r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|M|T|W|R|F)"
TIME_RE = r"(\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?)\s*-\s*(\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?)"
MEET_RE = re.compile(rf"({DAY_RE}(?:[/, &-]{DAY_RE})*)\s+{TIME_RE}")

DATE_WORDS = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)"
DATE_RE = re.compile(rf"({DATE_WORDS}\s+\d{{1,2}}(?:,\s*\d{{4}})?|\d{{1,2}}/\d{{1,2}}(?:/\d{{2,4}})?)", re.I)

def _clean_text(text: str) -> List[str]:
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines()]
    return [ln for ln in lines if ln]

def _read_pdf(file: UploadFile) -> str:
    with pdfplumber.open(file.file) as pdf:
        pages = []
        for p in pdf.pages:
            t = p.extract_text() or ""
            pages.append(t)
        return "\n".join(pages)

def _norm_time(t: str) -> str:
    # Return HH:MM 24h as "HH:MM" local-friendly for our ICS code (we localize later)
    dt = dparse.parse(t)
    return dt.strftime("%H:%M")

def _infer_semester_dates(lines: List[str]) -> tuple[str, str]:
    # crude defaults; you can expose UI to override later
    year = datetime.now().year
    return (f"{year}-01-06", f"{year}-04-25")

@router.post("/parse")
async def parse(files: List[UploadFile] = File(...)) -> Any:
    courses = []
    for f in files:
        raw = _read_pdf(f)
        lines = _clean_text(raw)

        # course name: first strong-looking line or a "Course:" line
        course_name = next((ln.split("Course:")[1].strip() for ln in lines if "Course:" in ln), None)
        if not course_name:
            course_name = lines[0][:80] if lines else f.filename

        start_date, end_date = _infer_semester_dates(lines)
        meetings = []
        assessments = []

        # meeting blocks
        for ln in lines:
            m = MEET_RE.search(ln)
            if m:
                days_raw = m.group(1)
                start_t, end_t = m.group(2), m.group(3)
                # map single-letter days too
                day_tokens = re.split(r"[/, &-]+", days_raw)
                day_map = {"M":"Mon","T":"Tue","W":"Wed","R":"Thu","F":"Fri","S":"Sat","U":"Sun"}
                norm_days = [day_map.get(d, d) for d in day_tokens]
                meetings.append({
                    "days": norm_days,
                    "start_local": _norm_time(start_t),
                    "end_local": _norm_time(end_t),
                    "start_date": start_date,
                    "end_date": end_date,
                    "location": "",
                    "type": "lecture"
                })

        # due items (very simple heuristic)
        for ln in lines:
            if re.search(r"\b(due|deadline|exam|quiz|project|milestone|presentation|final)\b", ln, re.I):
                date_match = DATE_RE.search(ln)
                if date_match:
                    dt = dparse.parse(date_match.group(1), fuzzy=True, default=datetime.now())
                    # time: if explicit, parse; else default 23:59
                    time_match = re.search(r"\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?", ln)
                    if not time_match:
                        dt = dt.replace(hour=23, minute=59)
                    title = re.sub(r"\s+", " ", re.sub(DATE_RE, "", ln)).strip()
                    if not title: title = "Due Item"
                    assessments.append({
                        "title": title[:80],
                        "due_datetime_local": dt.strftime("%Y-%m-%dT%H:%M"),
                        "category": "assignment",
                        "location": "",
                        "notes": ""
                    })

        course_id = re.sub(r"[^A-Za-z0-9]+", "-", course_name).strip("-")[:24]
        courses.append({
            "id": course_id or f.filename,
            "name": course_name,
            "timezone": "America/New_York",
            "meeting_blocks": meetings,
            "assessments": assessments,
            "office_hours": []
        })

    # trivial initial study tasks (you can regenerate in frontend later)
    return {"courses": courses, "study_tasks": []}
