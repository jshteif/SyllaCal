// frontend/components/CalendarPreview.tsx
"use client";
import { useMemo } from "react";
import type { Course, StudyTask, Filters } from "@/types";

type CalEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  location?: string;
};

const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function CalendarPreview({
  courses, studyTasks, filters, weekOf // Date at 00:00 (Sunday) to anchor preview
}: {
  courses: Course[];
  studyTasks: StudyTask[];
  filters: Filters;
  weekOf: Date;
}) {
  // Build concrete events for this preview week only
  const events: CalEvent[] = useMemo(() => {
    const out: CalEvent[] = [];
    const tzOffsetMs = 0; // preview local; keep simple

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
        const color = c.color ?? palette(idx);
        c.assessments.forEach(a => {
          const dt = new Date(a.due_datetime_local);
          if (!sameWeek(dt, weekOf)) return;
          add({
            id: `ass-${c.id}-${a.title}`,
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
    if (filters.includeStudySessions !== "none") {
      const allowed = new Set(
        filters.includeStudySessions === "selectedCourses"
          ? filters.studyCourses
          : courses.filter(c=>filters.courseInclusion[c.id]).map(c=>c.id)
      );
      studyTasks.forEach((s, idx) => {
        if (!allowed.has(s.course_id)) return;
        const color = (courses.find(c=>c.id===s.course_id)?.color) ?? palette(idx+3);
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
    <div className="rounded-2xl border shadow-sm overflow-hidden bg-white">
      <WeekGrid events={events} weekOf={weekOf}/>
    </div>
  );
}

function WeekGrid({events, weekOf}:{events:CalEvent[], weekOf:Date}) {
  // very small layout: 7 columns, 08:00–22:00 rows
  const hours = Array.from({length: 15}, (_,i)=>i+8);
  return (
    <div className="grid" style={{gridTemplateColumns: "80px repeat(7, 1fr)"}}>
      {/* header row */}
      <div className="p-2 text-sm font-semibold bg-gray-50">Time</div>
      {Array.from({length:7}, (_,i)=> {
        const d = new Date(weekOf); d.setDate(d.getDate()+i);
        return <div key={i} className="p-2 text-sm font-semibold bg-gray-50 border-l">{d.toLocaleDateString(undefined,{weekday:"short", month:"numeric", day:"numeric"})}</div>;
      })}

      {/* body */}
      {hours.map(h => (
        <>
          <div key={`h-${h}`} className="p-1 text-xs text-gray-500 border-t">{`${h}:00`}</div>
          {Array.from({length:7}, (_,i)=>(
            <div key={`cell-${h}-${i}`} className="relative border-t border-l h-16"/>
          ))}
        </>
      ))}

      {/* events (absolutely positioned into cells) */}
      {events.map((e, idx) => (
        <EventBlock key={idx} event={e} weekOf={weekOf}/>
      ))}
    </div>
  );
}

function EventBlock({event, weekOf}:{event:any, weekOf:Date}) {
  const day = event.start.getDay(); // 0..6
  const top = (event.start.getHours()-8 + event.start.getMinutes()/60) * 64; // 64px per hour
  const height = ((event.end - event.start)/3600000) * 64;
  return (
    <div
      className="absolute rounded-lg text-xs p-2 shadow"
      style={{
        gridColumn: `${day+2} / span 1`,
        transform: `translate(0, ${top}px)`,
        height: `${Math.max(24, height)}px`,
        backgroundColor: event.color,
        color: "#fff",
        margin: "2px"
      }}
      title={event.location || ""}
    >
      <div className="font-semibold truncate">{event.title}</div>
      <div className="opacity-90">
        {fmt(event.start)}–{fmt(event.end)}
      </div>
    </div>
  );
}

function fmt(d: Date){ return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }
function sameWeek(a:Date, weekStart:Date){
  const ws = new Date(weekStart); ws.setHours(0,0,0,0);
  const we = new Date(ws); we.setDate(ws.getDate()+7);
  return a >= ws && a < we;
}
function dateAtTime(weekStart: Date, dow: number, hhmm: string){
  const [h,m] = hhmm.split(":").map(Number);
  const d = new Date(weekStart); d.setDate(d.getDate()+dow); d.setHours(h, m, 0, 0);
  return d;
}
function palette(i:number){
  const colors = ["#2563EB","#16A34A","#DB2777","#F59E0B","#0EA5E9","#8B5CF6","#EF4444","#10B981"];
  return colors[i % colors.length];
}
