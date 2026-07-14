import {
  WORK_RECURRENCES,
  meetingTimeLabel,
  type WorkMeetingSummary,
  type WorkPersonSummary,
  type WorkTaskSummary,
  type WorkWorkspaceSummary,
} from "@/lib/work";
import {
  addMeetingTaskAction,
  archiveMeetingAction,
  createMeetingAction,
  updateMeetingAction,
} from "../actions";
import { WorkForm } from "./work-form";
import { Disclosure, Empty, FieldLabel, Meta, Section, type WorkNameMaps } from "./ui";

function scheduleLabel(meeting: WorkMeetingSummary): string {
  if (!meeting.scheduledAt) return "Unscheduled";
  const date = new Date(meeting.scheduledAt);
  const time = meetingTimeLabel(meeting.scheduledAt);
  switch (meeting.recurrence) {
    case "daily":
      return `Daily · ${time}`;
    case "weekly":
      return `${date.toLocaleDateString(undefined, { weekday: "long" })}s · ${time}`;
    case "biweekly":
      return `Every other ${date.toLocaleDateString(undefined, { weekday: "long" })} · ${time}`;
    case "monthly":
      return `Monthly on the ${date.getDate()} · ${time}`;
    default:
      return `${date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
  }
}

export function MeetingsSection({
  workspace,
  meetings,
  people,
  tasks,
  maps,
}: {
  workspace: WorkWorkspaceSummary;
  meetings: WorkMeetingSummary[];
  people: WorkPersonSummary[];
  tasks: WorkTaskSummary[];
  maps: WorkNameMaps;
}) {
  const openByMeeting = new Map<string, WorkTaskSummary[]>();
  for (const task of tasks) {
    if (task.status === "done" || !task.meetingId) continue;
    const list = openByMeeting.get(task.meetingId) ?? [];
    list.push(task);
    openByMeeting.set(task.meetingId, list);
  }

  return (
    <div className="space-y-5">
      <Section title={`Meetings · ${meetings.length}`}>
        {meetings.length === 0 ? (
          <Empty>No meetings yet. Add your recurring 1:1s and team meetings first.</Empty>
        ) : (
          <ul>
            {meetings.map((meeting, i) => {
              const linked = openByMeeting.get(meeting.id) ?? [];
              return (
                <li
                  key={meeting.id}
                  className="px-3 py-2"
                  style={i === meetings.length - 1 ? undefined : { borderBottom: "1px solid var(--border-faint)" }}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                      {meeting.title}
                    </span>
                    <Meta>{scheduleLabel(meeting)}</Meta>
                    {meeting.personId && maps.people.has(meeting.personId) && (
                      <Meta>· {maps.people.get(meeting.personId)}</Meta>
                    )}
                  </div>
                  {meeting.agenda && (
                    <p className="mt-0.5 whitespace-pre-line text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                      {meeting.agenda}
                    </p>
                  )}
                  {linked.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {linked.map((task) => (
                        <li key={task.id} className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                          ↳ {task.kind === "prep" ? "Prep: " : task.kind === "followup" ? "Follow-up: " : ""}
                          {task.title}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <form action={addMeetingTaskAction}>
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <input type="hidden" name="meetingId" value={meeting.id} />
                      <input type="hidden" name="meetingTitle" value={meeting.title} />
                      <input type="hidden" name="kind" value="prep" />
                      <button type="submit" className="text-[0.75rem] font-medium" style={{ color: "var(--text-faint)" }}>
                        + Prep task
                      </button>
                    </form>
                    <form action={addMeetingTaskAction}>
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <input type="hidden" name="meetingId" value={meeting.id} />
                      <input type="hidden" name="meetingTitle" value={meeting.title} />
                      <input type="hidden" name="kind" value="followup" />
                      <button type="submit" className="text-[0.75rem] font-medium" style={{ color: "var(--text-faint)" }}>
                        + Follow-up
                      </button>
                    </form>
                    <Disclosure summary="Notes & edit">
                      <WorkForm action={updateMeetingAction} submitLabel="Save meeting">
                        <input type="hidden" name="id" value={meeting.id} />
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <MeetingFields people={people} meeting={meeting} />
                      </WorkForm>
                    </Disclosure>
                    <form action={archiveMeetingAction}>
                      <input type="hidden" name="id" value={meeting.id} />
                      <button type="submit" className="text-[0.75rem] font-medium" style={{ color: "var(--text-ghost)" }}>
                        Archive
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="New meeting">
        <div className="px-3 py-2.5">
          <WorkForm action={createMeetingAction} submitLabel="Add meeting">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <MeetingFields people={people} />
          </WorkForm>
        </div>
      </Section>
    </div>
  );
}

function MeetingFields({
  people,
  meeting,
}: {
  people: WorkPersonSummary[];
  meeting?: WorkMeetingSummary;
}) {
  return (
    <div className="space-y-2">
      <input
        name="title"
        required
        maxLength={300}
        defaultValue={meeting?.title ?? ""}
        placeholder="Meeting title (e.g. 1:1 with manager)"
        className="field"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block col-span-2 sm:col-span-1">
          <FieldLabel>When</FieldLabel>
          <input
            type="datetime-local"
            name="scheduledAt"
            defaultValue={meeting?.scheduledAt ? toLocalInputValue(meeting.scheduledAt) : ""}
            className="field"
          />
        </label>
        <label className="block">
          <FieldLabel>Repeats</FieldLabel>
          <select name="recurrence" defaultValue={meeting?.recurrence ?? "none"} className="field">
            {WORK_RECURRENCES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <FieldLabel>Minutes</FieldLabel>
          <input
            type="number"
            name="durationMinutes"
            min={5}
            max={480}
            defaultValue={meeting?.durationMinutes ?? ""}
            className="field"
          />
        </label>
        {people.length > 0 && (
          <label className="block">
            <FieldLabel>With</FieldLabel>
            <select name="personId" defaultValue={meeting?.personId ?? ""} className="field">
              <option value="">—</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="block">
        <FieldLabel>Agenda / prep</FieldLabel>
        <textarea
          name="agenda"
          rows={2}
          maxLength={4000}
          defaultValue={meeting?.agenda ?? ""}
          placeholder="Topics to cover"
          className="field"
        />
      </label>
      <label className="block">
        <FieldLabel>Notes</FieldLabel>
        <textarea
          name="notes"
          rows={2}
          maxLength={8000}
          defaultValue={meeting?.notes ?? ""}
          placeholder="What happened, decisions made"
          className="field"
        />
      </label>
    </div>
  );
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in the wall-clock timezone; the
// server runtime is pinned to the owner's TZ so local Date parts are correct.
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
