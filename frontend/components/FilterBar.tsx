// frontend/components/FilterBar.tsx
"use client";
import { useMemo } from "react";
import type { Course, Filters } from "@/types";

export function FilterBar({
  courses,
  filters,
  onChange,
}: {
  courses: Course[];
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const allChecked = useMemo(() => courses.every(c => filters.courseInclusion[c.id] ?? true), [courses, filters]);

  return (
    <div className="grid gap-4 rounded-2xl p-4 border shadow-sm bg-white">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox"
            checked={filters.includeLectures}
            onChange={e => onChange({...filters, includeLectures: e.target.checked})}/>
          <span>Include class meetings (times & buildings)</span>
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox"
            checked={filters.includeAssignmentsAndExams}
            onChange={e => onChange({...filters, includeAssignmentsAndExams: e.target.checked})}/>
          <span>Include assignments & exams</span>
        </label>

        <div className="flex items-center gap-2">
          <span>Study sessions:</span>
          <select
            className="border rounded px-2 py-1"
            value={filters.includeStudySessions}
            onChange={e => onChange({...filters, includeStudySessions: e.target.value as Filters["includeStudySessions"]})}
          >
            <option value="none">None</option>
            <option value="all">All courses</option>
            <option value="selectedCourses">Selected courses…</option>
          </select>
        </div>
      </div>

      {filters.includeStudySessions === "selectedCourses" && (
        <div className="flex flex-wrap gap-3">
          {courses.map(c => (
            <label key={c.id} className="inline-flex items-center gap-2 border rounded-full px-3 py-1">
              <input type="checkbox"
                checked={filters.studyCourses.includes(c.id)}
                onChange={(e) => {
                  const set = new Set(filters.studyCourses);
                  e.target.checked ? set.add(c.id) : set.delete(c.id);
                  onChange({...filters, studyCourses: Array.from(set)});
                }} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      )}

      <div className="pt-2 border-t">
        <label className="flex items-center gap-2">
          <input type="checkbox"
            checked={allChecked}
            onChange={(e) => {
              const map: Filters["courseInclusion"] = {};
              courses.forEach(c => map[c.id] = e.target.checked);
              onChange({...filters, courseInclusion: map});
            }} />
          <span>Toggle all courses</span>
        </label>
        <div className="mt-2 flex flex-wrap gap-3">
          {courses.map(c => (
            <label key={c.id} className="inline-flex items-center gap-2 border rounded-md px-2 py-1">
              <input type="checkbox"
                checked={filters.courseInclusion[c.id] ?? true}
                onChange={(e) => {
                  onChange({
                    ...filters,
                    courseInclusion: {...filters.courseInclusion, [c.id]: e.target.checked}
                  });
                }} />
              <span className="h-3 w-3 rounded-full" style={{backgroundColor: c.color ?? "#999"}} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
