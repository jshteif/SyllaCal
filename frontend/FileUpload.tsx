"use client";
import { useRef, useState } from "react";
import type { Course, StudyTask } from "@/types";

export default function FileUpload({
  onParsed
}: { onParsed: (c: Course[], s: StudyTask[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const form = new FormData();
    Array.from(files).forEach(f => form.append("files", f));
    setBusy(true);
    try {
      const res = await fetch("http://localhost:8000/api/parse", { method:"POST", body: form });
      const json = await res.json();
      onParsed(json.courses || [], json.study_tasks || []);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border rounded-2xl p-6 bg-white shadow-sm">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e)=>handleFiles(e.target.files)}
      />
      <button
        className="px-4 py-2 rounded-xl bg-black text-white"
        onClick={()=>inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? "Parsing…" : "Upload syllabus PDFs"}
      </button>
    </div>
  );
}
