'use client';

import { useMemo, useRef, useState } from 'react';

/* =========================
   Types
========================= */
type EventKind = 'lecture' | 'assignment' | 'exam' | 'study';

type DayName = 'Sun'|'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat';

interface MeetingBlock {
  days: DayName[];
  start_local: string; // "13:30"
  end_local: string;   // "14:45"
  start_date: string;  // "2025-01-06"
  end_date: string;    // "2025-04-25"
  location?: string;
  type: 'lecture';
}

type Category = 'assignment' | 'exam' | 'project' | 'quiz' | 'milestone';

interface Assessment {
  id?: string;
  title: string;
  due_datetime_local: string; // ISO local like "2025-03-06T12:30"
  category: Category;
  location?: string;
  notes?: string;
}

interface Course {
  id: string;
  name: string;
  color?: string;
  meeting_blocks: MeetingBlock[];
  assessments: Assessment[];
}

interface StudyTask {
  id?: string;
  course_id: string;
  title: string;
  start_local: string; // ISO local "YYYY-MM-DDTHH:MM"
  end_local: string;   // ISO local
  related_assessment?: string;
  notes?: string;
}

interface Filters {
  includeLectures: boolean;
  includeAssignmentsAndExams: boolean;
  includeStudySessions: 'none' | 'all' | 'selectedCourses';
  studyCourses: string[];
  courseInclusion: Record<string, boolean>;
}

/* =========================
   Page
========================= */
export default function PlanPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [study, setStudy] = useState<StudyTask[]>([]);
  const [busy, setBusy] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    includeLectures: true,
    includeAssignmentsAndExams: true,
    includeStudySessions: 'all',
    studyCourses: [],
    courseInclusion: {}
  });

  // Anchor preview to the most recent Sunday
  const weekOf = useMemo(() => {
    const d = new Date();
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - day);
    d.setHours(0,0,0,0);
    return d;
  }, []);

  const handleParsed = (c: Course[], s: StudyTask[]) => {
    const palette = ['#2563EB','#16A34A','#DB2777','#F59E0B','#0EA5E9','#8B5CF6','#EF4444','#10B981'];
    const withColors = c.map((ci, i) => ({ ...ci, color: palette[i % palette.length] }));
    const courseInclusion: Record<string, boolean> = {};
    withColors.forEach(ci => courseInclusion[ci.id] = true);
    setCourses(withColors);
    setStudy(s || []);
    setFilters(f => ({ ...f, courseInclusion }));
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const form = new FormData();
      Array.from(files).forEach(f => form.append('files', f));
      const res = await fetch('http://localhost:8000/api/parse', {
        method: 'POST',
        body: form
      });
      if (!res.ok) throw new Error(`Parse failed (${res.status})`);
      const json = await res.json();
      handleParsed(json.courses || [], json.study_tasks || []);
    } catch (e) {
      alert(`Upload/parse error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/ics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courses, study_tasks: study, filters })
      });
      if (!res.ok) throw new Error(`ICS export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'syllacal.ics';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Export error: ${(e as Error).message}`);
    }
  };

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>syllaCal — Planner</h1>
      <p style={{ color: '#555', marginBottom: 16 }}>
        Upload 1–N syllabus PDFs → review → filter → preview → export to calendar (.ics).
      </p>

      {/* Step bar */}
      <ol style={{ display: 'flex', gap: 12, fontSize: 13, color: '#666', marginBottom: 16 }}>
        <li>1) Upload PDFs</li>
        <li>2) Review</li>
        <li>3) Filter & Preview</li>
        <li>4) Export</li>
      </ol>

      {/* Upload */}
      <UploadCard busy={busy} onUpload={onUpload} />

      {/* Filters & Preview */}
      {courses.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <FilterBar
            courses={courses}
            filters={filters}
            onChange={setFilters}
          />

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Calendar Preview</h2>
            <button
              onClick={handleExport}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                background: 'black',
                color: 'white',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Export .ics
            </button>
          </div>

          <div style={{ height: 12 }} />
          <CalendarPreview
            courses={courses}
            studyTasks={study}
            filters={filters}
            weekOf={weekOf}
          />
        </>
      )}
    </div>
  );
}

/* =========================
   Upload card
========================= */
function UploadCard({ busy, onUpload }: { busy: boolean; onUpload: (files: FileList | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{
      border: '1px solid #e5e7eb',
      background: 'white',
      borderRadius: 16,
      padding: 16,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
    }}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => onUpload(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          padding: '10px 16px',
          borderRadius: 12,
          background: busy ? '#9ca3af' : '#111827',
          color: 'white',
          fontWeight: 600,
          border: 'none',
          cursor: busy ? 'not-allowed' : 'pointer'
        }}
      >
        {busy ? 'Parsing…' : 'Upload syllabus PDFs'}
      </button>
    </div>
  );
}

/* =========================
   Filter bar
========================= */
function FilterBar({
  courses, filters, onChange
}: {
  courses: Course[];
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const allChecked = useMemo(
    () => courses.every(c => filters.courseInclusion[c.id] ?? true),
    [courses, filters]
  );

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      background: 'white',
      borderRadius: 16,
      padding: 16,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
    }}>
      {/* Toggles */}
      <div style={{ display:'flex', flexWrap:'wrap', gap: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={filters.includeLectures}
            onChange={(e) => onChange({ ...filters, includeLectures: e.target.checked })}
          />
          <span>Include class meetings (times & buildings)</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={filters.includeAssignmentsAndExams}
            onChange={(e) => onChange({ ...filters, includeAssignmentsAndExams: e.target.checked })}
          />
          <span>Include assignments & exams</span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Study sessions:</span>
          <select
            value={filters.includeStudySessions}
            onChange={(e) =>
              onChange({ ...filters, includeStudySessions: e.target.value as Filters['includeStudySessions'] })
            }
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          >
            <option value="none">None</option>
            <option value="all">All courses</option>
            <option value="selectedCourses">Selected courses…</option>
          </select>
        </div>
      </div>

      {/* Study course selection */}
      {filters.includeStudySessions === 'selectedCourses' && (
        <div style={{ display:'flex', flexWrap:'wrap', gap: 12, marginTop: 12 }}>
          {courses.map(c => (
            <label key={c.id} style={{ display:'inline-flex', alignItems:'center', gap: 8, border: '1px solid #e5e7eb', borderRadius: 999, padding: '6px 10px' }}>
              <input
                type="checkbox"
                checked={filters.studyCourses.includes(c.id)}
                onChange={(e) => {
                  const set = new Set(filters.studyCourses);
                  e.target.checked ? set.add(c.id) : set.delete(c.id);
                  onChange({ ...filters, studyCourses: Array.from(set) });
                }}
              />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      )}

      {/* Per-course inclusion */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
        <label style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => {
              const map: Filters['courseInclusion'] = {};
              courses.forEach(c => (map[c.id] = e.target.checked));
              onChange({ ...filters, courseInclusion: map });
            }}
          />
          <span>Toggle all courses</span>
        </label>

        <div style={{ display:'flex', flexWrap:'wrap', gap: 10, marginTop: 8 }}>
          {courses.map((c, idx) => (
            <label key={c.id} style={{ display:'inline-flex', alignItems:'center', gap: 8, border: '1px solid #e5e7eb', borderRadius: 10, padding: '6px 10px' }}>
              <input
                type="checkbox"
                checked={filters.courseInclusion[c.id] ?? true}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    courseInclusion: { ...filters.courseInclusion, [c.id]: e.target.checked }
                  })
                }
              />
              <span
                style={{
                  display:'inline-block',
                  width: 10, height: 10, borderRadius: 999,
                  background: c.color ?? palette(idx)
                }}
              />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Calendar preview
========================= */
type CalEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  location?: string;
};

function CalendarPreview({
  courses, studyTasks, filters, weekOf
}: {
  courses: Course[];
  studyTasks: StudyTask[];
  filters: Filters;
  weekOf: Date;
}) {
  const events: CalEvent[] = useMemo(() => {
    const out: CalEvent[] = [];

    const add = (e: CalEvent) => out.push(e);

    // Lectures
    if (filters.includeLectures) {
      courses.forEach((c, idx) => {
        if (!filters.courseInclusion[c.id]) return;
        const color = c.color ?? palette(idx);
        c.meeting_blocks.forEach(mb => {
          mb.days.forEach(day => {
            const dow = DOW.indexOf(day);
            if (dow === -1) return;
            const start = dateAtTime(weekOf, dow, mb.start_local);
            const end   = dateAtTime(weekOf, dow, mb.end_local);
            add({
              id: `lec-${c.id}-${day}`,
              title: `${c.name} Lecture`,
              start, end, color,
              location: mb.location
            });
          });
        });
      });
    }

    // Assignments/Exams
    if (filters.includeAssignmentsAndExams) {
      courses.forEach((c, idx) => {
        if (!filters.courseInclusion[c.id]) return;
        const color = c.color ?? palette(idx+3);
        c.assessments.forEach(a => {
          const dt = new Date(a.due_datetime_local);
          if (!sameWeek(dt, weekOf)) return;
          add({
            id: `ass-${c.id}-${a.title}-${a.due_datetime_local}`,
            title: `${a.title} — ${c.name}`,
            start: dt,
            end: new Date(dt.getTime() + 60*60*1000),
            color,
            location: a.location
          });
        });
      });
    }

    // Study sessions
    if (filters.includeStudySessions !== 'none') {
      const allowed = new Set(
        filters.includeStudySessions === 'selectedCourses'
          ? filters.studyCourses
          : courses.filter(c => filters.courseInclusion[c.id]).map(c => c.id)
      );
      studyTasks.forEach((s, idx) => {
        if (!allowed.has(s.course_id)) return;
        const color = (courses.find(c=>c.id===s.course_id)?.color) ?? palette(idx+5);
        const start = new Date(s.start_local);
        const end   = new Date(s.end_local);
        if (!sameWeek(start, weekOf)) return;
        add({
          id: `study-${s.course_id}-${s.title}-${s.start_local}`,
          title: `Study — ${s.title}`,
          start, end, color
        });
      });
    }

    return out.sort((a,b)=>a.start.getTime()-b.start.getTime());
  }, [courses, studyTasks, filters, weekOf]);

  return (
    <WeekGrid events={events} weekOf={weekOf}/>
  );
}

function WeekGrid({ events, weekOf }: { events: CalEvent[]; weekOf: Date }) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 08:00–22:00
  return (
    <div style={{
      border: '1px solid #e5e7eb',
      background: 'white',
      borderRadius: 16,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)' }}>
        {/* header row */}
        <div style={{ padding: 8, fontSize: 13, fontWeight: 600, background: '#f9fafb' }}>Time</div>
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekOf); d.setDate(d.getDate() + i);
          const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
          return (
            <div key={i} style={{ padding: 8, fontSize: 13, fontWeight: 600, background: '#f9fafb', borderLeft: '1px solid #e5e7eb' }}>
              {label}
            </div>
          );
        })}

        {/* body grid */}
        {hours.map((h) => (
          <FragmentRow key={`row-${h}`} hour={h} />
        ))}

        {/* events */}
        {events.map((e, idx) => (
          <EventBlock key={idx} event={e} weekOf={weekOf} />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ hour }: { hour: number }) {
  return (
    <>
      <div style={{ padding: 6, fontSize: 12, color: '#6b7280', borderTop: '1px solid #e5e7eb' }}>
        {hour}:00
      </div>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={`cell-${hour}-${i}`} style={{ position: 'relative', borderTop: '1px solid #e5e7eb', borderLeft: '1px solid #e5e7eb', height: 64 }} />
      ))}
    </>
  );
}

function EventBlock({ event, weekOf }: { event: CalEvent; weekOf: Date }) {
  const day = event.start.getDay(); // 0..6
  const top = ((event.start.getHours() - 8) + event.start.getMinutes() / 60) * 64;
  const height = Math.max(24, ((event.end.getTime() - event.start.getTime()) / 3600000) * 64);

  return (
    <div
      style={{
        gridColumn: `${day + 2} / span 1`,
        transform: `translate(0, ${top}px)`,
        position: 'relative'
      }}
    >
      <div
        title={event.location || ''}
        style={{
          position: 'absolute',
          left: 2,
          right: 2,
          height,
          borderRadius: 10,
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          background: event.color,
          color: 'white',
          padding: '8px 10px',
          fontSize: 12,
          overflow: 'hidden'
        }}
      >
        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
          {event.title}
        </div>
        <div style={{ opacity: 0.95 }}>
          {fmt(event.start)}–{fmt(event.end)}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Utilities
========================= */
const DOW: DayName[] = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmt(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sameWeek(a: Date, weekStart: Date) {
  const ws = new Date(weekStart); ws.setHours(0,0,0,0);
  const we = new Date(ws); we.setDate(ws.getDate() + 7);
  return a >= ws && a < we;
}

function dateAtTime(weekStart: Date, dow: number, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dow);
  d.setHours(h, m, 0, 0);
  return d;
}

function palette(i: number) {
  const colors = ['#2563EB','#16A34A','#DB2777','#F59E0B','#0EA5E9','#8B5CF6','#EF4444','#10B981'];
  return colors[i % colors.length];
}