export type EventKind = "lecture" | "assignment" | "exam" | "study";

export interface Course {
  id: string;
  name: string;
  color?: string;
  meeting_blocks: Array<{
    days: ("Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun")[];
    start_local: string;
    end_local: string;
    start_date: string;
    end_date: string;
    location?: string;
    type: "lecture";
  }>;
  assessments: Array<{
    id?: string;
    title: string;
    due_datetime_local: string;
    category: "assignment" | "exam" | "project" | "quiz" | "milestone";
    location?: string;
    notes?: string;
  }>;
  office_hours?: any[];
}

export interface StudyTask {
  id?: string;
  course_id: string;
  title: string;
  start_local: string;
  end_local: string;
  related_assessment?: string;
  notes?: string;
}

export interface Filters {
  includeLectures: boolean;
  includeAssignmentsAndExams: boolean;
  includeStudySessions: "none" | "all" | "selectedCourses";
  studyCourses: string[];
  courseInclusion: Record<string, boolean>;
}
