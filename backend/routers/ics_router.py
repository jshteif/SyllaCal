# backend/routers/ics_router.py
from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Literal, Dict, Optional
from icalendar import Calendar, Event, Alarm
from datetime import datetime, timedelta
import pytz
import uuid

router = APIRouter()

# ---------- Data models (must match what your frontend sends) ----------

class MeetingBlock(BaseModel):
    days: List[str]                 # ["Mon","Wed"] etc.
    start_local: str                # "13:30" (24h, local time)
    end_local: str                  # "14:45"
    start_date: str                 # "2025-01-06" (first class date)
    end_date: str                   # "2025-04-25" (last class date)
    location: Optional[str] = None
    type: Literal["lecture"]

class Assessment(BaseModel):
    id: Optional[str] = None
    title: str
    due_datetime_local: str         # "2025-03-06T12:30" (local)
    category: Literal["assignment","exam","project","quiz","milestone"]
    location: Optional[str] = None
    notes: Optional[str] = None

class Course(BaseModel):
    id: str
    name: str
    color: Optional[str] = None     # used by preview only; ignored here
    meeting_blocks: List[MeetingBlock]
    assessments: List[Assessment]

class StudyTask(BaseModel):
    id: Optional[str] = None
    course_id: str
    title: str
    start_local: str                # "2025-03-03T19:00"
    end_local: str                  # "2025-03-03T21:00"
    related_assessment: Optional[str] = None
    notes: Optional[str] = None

class Filters(BaseModel):
    includeLectures: bool
    includeAssignmentsAndExams: bool
    includeStudySessions: Literal["none","all","selectedCourses"]
    studyCourses: List[str]         # course_ids used when "selectedCourses"
    courseInclusion: Dict[str, bool]# per-course on/off

# ---------- Helpers & constants ----------

TZ = pytz.timezone("America/New_York")
DOW_MAP = {"Mon":"MO", "Tue":"TU", "Wed":"WE", "Thu":"TH", "Fri":"FR", "Sat":"SA", "Sun":"SU"}

# syllaCal identity
def _uid() -> str:
    return f"{uuid.uuid4()}@syllacal"  # <- domain tag uses new name

cal = Calendar()
cal.add("prodid", "-//syllaCal//EN")
cal.add("version", "2.0")
cal.add("X-WR-CALNAME", "syllaCal")  # nice display name in calendar apps

def _local_iso_to_dt(dt_str: str) -> datetime:
    """
    Parse a local ISO-like string (YYYY-MM-DDTHH:MM) with no TZ info
    and return a timezone-aware datetime in America/New_York.
    """
    # fromisoformat supports "YYYY-MM-DDTHH:MM"
    naive = datetime.fromisoformat(dt_str)
    return TZ.localize(naive)

# ---------- Route ----------

@router.post("/ics")
def make_ics(payload: dict):
    """
    Body shape:
    {
      "courses": [Course...],
      "study_tasks": [StudyTask...],
      "filters": Filters
    }
    Returns: text/calendar (.ics) honoring the filters sent by the client.
    """
    courses = [Course(**c) for c in payload.get("courses", [])]
    study_tasks = [StudyTask(**s) for s in payload.get("study_tasks", [])]
    filters = Filters(**payload["filters"])

    cal = Calendar()
    cal.add("prodid", "-//syllaCal//EN")
    cal.add("version", "2.0")
    cal.add("X-WR-CALNAME", "syllaCal")  # nice to have for some clients

    def add_alarm(vevent: Event, minutes_before: int, message: str = "Upcoming event"):
        alarm = Alarm()
        alarm.add("action", "DISPLAY")
        alarm.add("trigger", timedelta(minutes=-minutes_before))
        alarm.add("description", message)
        vevent.add_component(alarm)

    # ----- Lectures (recurring) -----
    if filters.includeLectures:
        for c in courses:
            if not filters.courseInclusion.get(c.id, True):
                continue
            for mb in c.meeting_blocks:
                # First occurrence uses the start_date with the specified time
                dtstart_local = _local_iso_to_dt(f"{mb.start_date}T{mb.start_local}")
                dtend_local   = _local_iso_to_dt(f"{mb.start_date}T{mb.end_local}")
                # UNTIL must be UTC; use the meeting end time on the final date
                until_utc = _local_iso_to_dt(f"{mb.end_date}T{mb.end_local}").astimezone(pytz.UTC)

                ve = Event()
                ve.add("uid", _uid())
                ve.add("dtstamp", datetime.utcnow())
                ve.add("dtstart", dtstart_local)
                ve.add("dtend", dtend_local)
                byday = ",".join(DOW_MAP[d] for d in mb.days if d in DOW_MAP)
                ve.add("rrule", {"FREQ": "WEEKLY", "BYDAY": byday, "UNTIL": until_utc})
                ve.add("summary", f"{c.name} Lecture")
                if mb.location:
                    ve.add("location", mb.location)
                ve.add("description", f"Course: {c.name} ({c.id})")
                add_alarm(ve, 15, "Class starting soon")
                cal.add_component(ve)

    # ----- Assessments (single events) -----
    if filters.includeAssignmentsAndExams:
        for c in courses:
            if not filters.courseInclusion.get(c.id, True):
                continue
            for a in c.assessments:
                dt = _local_iso_to_dt(a.due_datetime_local)

                ve = Event()
                ve.add("uid", _uid())
                ve.add("dtstamp", datetime.utcnow())
                # For deadlines we set a 1-hour block at the due time; adjust if you prefer all-day
                ve.add("dtstart", dt)
                ve.add("dtend", dt + timedelta(hours=1))
                ve.add("summary", f"{a.title} — {c.name}")
                if a.location:
                    ve.add("location", a.location)

                desc_lines = [
                    f"Category: {a.category}",
                    f"Course: {c.name} ({c.id})"
                ]
                if a.notes:
                    desc_lines.append(f"Notes: {a.notes}")
                ve.add("description", "\n".join(desc_lines))

                add_alarm(ve, 30, "Due soon")
                cal.add_component(ve)

    # ----- Study sessions (single events) -----
    if filters.includeStudySessions != "none":
        allowed_courses = (
            set(filters.studyCourses)
            if filters.includeStudySessions == "selectedCourses"
            else {c.id for c in courses if filters.courseInclusion.get(c.id, True)}
        )
        for s in study_tasks:
            if s.course_id not in allowed_courses:
                continue

            dtstart = _local_iso_to_dt(s.start_local)
            dtend   = _local_iso_to_dt(s.end_local)

            ve = Event()
            ve.add("uid", _uid())
            ve.add("dtstamp", datetime.utcnow())
            ve.add("dtstart", dtstart)
            ve.add("dtend", dtend)
            ve.add("summary", f"Study — {s.title}")
            desc = f"Course: {s.course_id}"
            if s.related_assessment:
                desc += f"\nRelated: {s.related_assessment}"
            if s.notes:
                desc += f"\nNotes: {s.notes}"
            ve.add("description", desc)

            add_alarm(ve, 10, "Study session starting")
            cal.add_component(ve)

    ics_bytes = cal.to_ical()
    return Response(
        content=cal.to_ical(),
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="syllacal.ics"'}  # <- new filename
    )
