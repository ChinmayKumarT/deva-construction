"use client";

import { useFormState, useFormStatus } from "react-dom";
import { markAttendance, type MarkAttendanceState } from "@/app/admin/actions";

const initialState: MarkAttendanceState = { error: null };

function StatusButton({ status, label, active }: { status: string; label: string; active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="status"
      value={status}
      disabled={pending}
      className={
        "rounded-md border px-2 py-1 text-xs disabled:opacity-50 " +
        (active
          ? "border-slate-800 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100")
      }
    >
      {label}
    </button>
  );
}

export function AttendanceMarkForm({
  labourerId,
  projectId,
  date,
  currentStatus,
}: {
  labourerId: string;
  projectId: string;
  date: string;
  currentStatus: string | undefined;
}) {
  const [state, formAction] = useFormState(markAttendance, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="labourer_id" value={labourerId} />
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="date" value={date} />
      <div className="flex gap-1">
        {(["present", "half_day", "overtime", "absent"] as const).map((s) => (
          <StatusButton key={s} status={s} label={s === "overtime" ? "OT 1.5×" : s.replace("_", " ")} active={currentStatus === s} />
        ))}
      </div>
      {state.error && <p className="mt-1 max-w-xs text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
