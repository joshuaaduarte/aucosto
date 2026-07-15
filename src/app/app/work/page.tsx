import Link from "next/link";
import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  getOrCreateDefaultWorkspace,
  getReview,
  listAreas,
  listCoworkerCandidates,
  listMeetings,
  listNotes,
  listPeople,
  listProjects,
  listTasks,
  listUnlinkedProjectOptions,
} from "@/lib/services/work";
import { workDayKey, workWeekKey } from "@/lib/work";
import { buildNameMaps } from "./_components/ui";
import { SetupSection } from "./_components/setup-section";
import { TodaySection } from "./_components/today-section";
import { ProjectsSection } from "./_components/projects-section";
import { AreasSection } from "./_components/areas-section";
import { PeopleSection } from "./_components/people-section";
import { MeetingsSection } from "./_components/meetings-section";
import { NotesSection } from "./_components/notes-section";
import { ReviewSection } from "./_components/review-section";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "today", label: "Today" },
  { id: "projects", label: "Projects" },
  { id: "areas", label: "Areas" },
  { id: "people", label: "People" },
  { id: "meetings", label: "Meetings" },
  { id: "notes", label: "Notes" },
  { id: "review", label: "Review" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "today";

  const userId = await resolveActiveUserId();
  const workspace = await getOrCreateDefaultWorkspace(userId);

  if (!workspace) {
    return (
      <div className="space-y-3">
        <h1 className="text-[1.5rem] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Work
        </h1>
        <p className="callout text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          The Work workspace couldn&apos;t be loaded — check /api/health and try again.
        </p>
      </div>
    );
  }

  const today = new Date();
  const [areas, projects, people, meetings, tasks, notes, shutdown, weekly, candidates, projectOptions] =
    await Promise.all([
      listAreas(userId, workspace.id),
      listProjects(userId, workspace.id),
      listPeople(userId, workspace.id),
      listMeetings(userId, workspace.id),
      listTasks(userId, workspace.id),
      listNotes(userId, workspace.id),
      getReview(userId, workspace.id, "shutdown", workDayKey(today)),
      getReview(userId, workspace.id, "weekly", workWeekKey(today)),
      listCoworkerCandidates(userId, workspace.id, workspace.name),
      listUnlinkedProjectOptions(userId, workspace.id),
    ]);
  const maps = buildNameMaps(areas, projects, people, meetings);
  const isEmptyWorkspace =
    areas.length === 0 &&
    projects.length === 0 &&
    people.length === 0 &&
    meetings.length === 0 &&
    tasks.length === 0;

  return (
    <div className="space-y-5">
      <header className="fade-in">
        <div className="flex items-baseline gap-2">
          <h1
            className="text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            Work
          </h1>
          <span className="text-[0.9375rem] font-medium" style={{ color: "var(--text-faint)" }}>
            · {workspace.name}
          </span>
        </div>
        {workspace.description && (
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {workspace.description}
          </p>
        )}
      </header>

      <nav
        className="no-scrollbar fade-in-delay-1 -mx-1 flex gap-1 overflow-x-auto px-1"
        aria-label="Work sections"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={t.id === "today" ? "/app/work" : `/app/work?tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              className="shrink-0 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
              style={{
                background: active ? "var(--text)" : "transparent",
                color: active ? "var(--bg-page)" : "var(--text-muted)",
                border: `1px solid ${active ? "var(--text)" : "var(--border-faint)"}`,
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="fade-in-delay-2">
        {tab === "today" && isEmptyWorkspace ? (
          <SetupSection workspace={workspace} candidates={candidates} projectOptions={projectOptions} />
        ) : null}
        {tab === "today" && !isEmptyWorkspace && (
          <TodaySection
            workspace={workspace}
            tasks={tasks}
            meetings={meetings}
            shutdown={shutdown}
            maps={maps}
            today={today}
          />
        )}
        {tab === "projects" && (
          <ProjectsSection
            workspace={workspace}
            projects={projects}
            areas={areas}
            tasks={tasks}
            notes={notes}
            maps={maps}
            today={today}
            linkOptions={projectOptions}
          />
        )}
        {tab === "areas" && (
          <AreasSection workspace={workspace} areas={areas} projects={projects} tasks={tasks} />
        )}
        {tab === "people" && (
          <PeopleSection
            workspace={workspace}
            people={people}
            tasks={tasks}
            candidates={candidates}
          />
        )}
        {tab === "meetings" && (
          <MeetingsSection
            workspace={workspace}
            meetings={meetings}
            people={people}
            tasks={tasks}
            maps={maps}
          />
        )}
        {tab === "notes" && <NotesSection workspace={workspace} notes={notes} maps={maps} />}
        {tab === "review" && (
          <ReviewSection
            workspace={workspace}
            areas={areas}
            projects={projects}
            tasks={tasks}
            notes={notes}
            weekly={weekly}
            maps={maps}
            today={today}
          />
        )}
      </div>
    </div>
  );
}
