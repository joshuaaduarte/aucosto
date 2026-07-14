import {
  groupTasksForToday,
  meetingsOnDay,
  meetingTimeLabel,
  type WorkMeetingSummary,
  type WorkReviewSummary,
  type WorkTaskSummary,
  type WorkWorkspaceSummary,
} from "@/lib/work";
import {
  addMeetingTaskAction,
  createTaskAction,
  saveShutdownAction,
} from "../actions";
import { WorkForm } from "./work-form";
import { TaskList } from "./task-list";
import { Disclosure, Empty, FieldLabel, LinkSelects, Meta, Section, type WorkNameMaps } from "./ui";

export function TodaySection({
  workspace,
  tasks,
  meetings,
  shutdown,
  maps,
  today,
}: {
  workspace: WorkWorkspaceSummary;
  tasks: WorkTaskSummary[];
  meetings: WorkMeetingSummary[];
  shutdown: WorkReviewSummary | null;
  maps: WorkNameMaps;
  today: Date;
}) {
  const grouped = groupTasksForToday(tasks, today);
  const todayMeetings = meetingsOnDay(meetings, today);

  return (
    <div className="space-y-5">
      <Section title="Today's meetings">
        {todayMeetings.length === 0 ? (
          <Empty>No meetings today.</Empty>
        ) : (
          <ul>
            {todayMeetings.map((meeting, i) => (
              <li
                key={meeting.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2"
                style={i === todayMeetings.length - 1 ? undefined : { borderBottom: "1px solid var(--border-faint)" }}
              >
                <span className="tabular text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  {meetingTimeLabel(meeting.scheduledAt)}
                </span>
                <span className="text-[0.875rem]" style={{ color: "var(--text)" }}>
                  {meeting.title}
                </span>
                {meeting.personId && maps.people.has(meeting.personId) && (
                  <Meta>· {maps.people.get(meeting.personId)}</Meta>
                )}
                {meeting.agenda && (
                  <span className="w-full truncate text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    {meeting.agenda}
                  </span>
                )}
                <form action={addMeetingTaskAction} className="ml-auto">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="meetingId" value={meeting.id} />
                  <input type="hidden" name="meetingTitle" value={meeting.title} />
                  <input type="hidden" name="kind" value="followup" />
                  <button type="submit" className="btn-ghost px-2 py-0.5 text-[0.6875rem]">
                    + Follow-up
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Must do">
        <TaskList
          tasks={grouped.mustDo}
          workspaceId={workspace.id}
          maps={maps}
          today={today}
          emptyText="Nothing due or flagged important — pull something forward or enjoy the slack."
        />
      </Section>

      {grouped.prep.length > 0 && (
        <Section title="Prep">
          <TaskList tasks={grouped.prep} workspaceId={workspace.id} maps={maps} today={today} />
        </Section>
      )}

      <Section title="Waiting on">
        <TaskList
          tasks={grouped.waiting}
          workspaceId={workspace.id}
          maps={maps}
          today={today}
          emptyText="Not waiting on anyone."
        />
      </Section>

      <Section title="Add a task">
        <div className="px-3 py-2.5">
          <WorkForm action={createTaskAction} submitLabel="Add task">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <div className="space-y-2">
              <input
                name="title"
                required
                maxLength={300}
                placeholder="Next concrete action…"
                className="field"
              />
              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <FieldLabel>Due</FieldLabel>
                  <input type="date" name="dueDate" className="field" />
                </label>
                <label className="block">
                  <FieldLabel>Waiting on</FieldLabel>
                  <input name="waitingOn" maxLength={200} placeholder="Who / what" className="field" />
                </label>
                <label
                  className="flex items-center gap-1.5 pb-3 text-[0.8125rem]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <input type="checkbox" name="isImportant" />
                  Important
                </label>
              </div>
              <Disclosure summary="Link to area / project / person / meeting">
                <LinkSelects maps={maps} />
              </Disclosure>
            </div>
          </WorkForm>
        </div>
      </Section>

      <ShutdownCard workspace={workspace} shutdown={shutdown} openLoops={grouped.mustDo.length} />
    </div>
  );
}

function ShutdownCard({
  workspace,
  shutdown,
  openLoops,
}: {
  workspace: WorkWorkspaceSummary;
  shutdown: WorkReviewSummary | null;
  openLoops: number;
}) {
  return (
    <Section
      title="Daily shutdown"
      aside={
        shutdown ? (
          <Meta>Saved today ✓</Meta>
        ) : (
          <Meta>{openLoops > 0 ? `${openLoops} must-do item${openLoops === 1 ? "" : "s"} still open` : "Clear board"}</Meta>
        )
      }
    >
      <div className="px-3 py-2.5">
        <ol className="mb-3 space-y-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          <li>1. Sweep inboxes and today&apos;s meeting notes for follow-ups → add them above.</li>
          <li>2. Anything unfinished: reschedule it or note it as a loose end.</li>
          <li>3. Choose tomorrow&apos;s first work focus, then close the laptop.</li>
        </ol>
        <WorkForm action={saveShutdownAction} submitLabel={shutdown ? "Update shutdown" : "Save shutdown"}>
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <div className="space-y-2">
            <label className="block">
              <FieldLabel>Loose ends</FieldLabel>
              <textarea
                name="looseEnds"
                rows={2}
                maxLength={8000}
                defaultValue={shutdown?.looseEnds ?? ""}
                placeholder="Open loops you're deliberately parking overnight"
                className="field"
              />
            </label>
            <label className="block">
              <FieldLabel>Tomorrow&apos;s first focus</FieldLabel>
              <input
                name="tomorrowFocus"
                maxLength={500}
                defaultValue={shutdown?.tomorrowFocus ?? ""}
                placeholder="The one thing to start with"
                className="field"
              />
            </label>
          </div>
        </WorkForm>
      </div>
    </Section>
  );
}
