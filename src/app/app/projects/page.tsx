import type { ReactNode } from "react";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/projects";
import { listProjects, type ProjectSummary } from "@/lib/services/projects";
import { formatMinutes } from "@/lib/do";
import { updateProjectAction } from "./actions";
import { ProjectCreateForm } from "./create-form";

export const dynamic = "force-dynamic";

function SectionCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border p-5" style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[1rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <li className="rounded-md border p-4" style={{ borderColor: "var(--border-faint)" }}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.9375rem] font-medium" style={{ color: "var(--text)" }}>
                {project.name}
              </p>
              <span className="pill">{PROJECT_STATUS_LABELS[project.status]}</span>
              {project.bucket ? <span className="pill">{project.bucket}</span> : null}
            </div>
            {project.summary ? (
              <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                {project.summary}
              </p>
            ) : null}
            <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              {project.openTaskCount} open task{project.openTaskCount === 1 ? "" : "s"}
              {project.scheduledMinutes > 0 ? ` · ${formatMinutes(project.scheduledMinutes)} scheduled` : ""}
              {project.trackedMinutes > 0 ? ` · ${formatMinutes(project.trackedMinutes)} tracked` : ""}
              {project.targetDate
                ? ` · Target ${project.targetDate.toLocaleDateString()}`
                : ""}
            </p>
          </div>
          {project.nextMilestone ? (
            <div className="rounded-md border px-3 py-2 text-[0.75rem]" style={{ borderColor: "var(--border-faint)", color: "var(--text-muted)" }}>
              Next milestone: {project.nextMilestone}
            </div>
          ) : null}
        </div>

        <details className="rounded-md border" style={{ borderColor: "var(--border-faint)" }}>
          <summary className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
            Edit project
          </summary>
          <form action={updateProjectAction} className="space-y-3 px-3 pb-3">
            <input type="hidden" name="id" value={project.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor={`project-name-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Name
                </label>
                <input id={`project-name-${project.id}`} name="name" defaultValue={project.name} required className="field" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`project-status-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Status
                </label>
                <select id={`project-status-${project.id}`} name="status" defaultValue={project.status} className="field">
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PROJECT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor={`project-bucket-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Bucket
                </label>
                <input id={`project-bucket-${project.id}`} name="bucket" defaultValue={project.bucket ?? ""} className="field" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`project-targetDate-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  Target date
                </label>
                <input id={`project-targetDate-${project.id}`} name="targetDate" type="date" defaultValue={project.targetDate ? project.targetDate.toISOString().slice(0, 10) : ""} className="field" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`project-summary-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Outcome
              </label>
              <input id={`project-summary-${project.id}`} name="summary" defaultValue={project.summary ?? ""} className="field" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`project-nextMilestone-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Next milestone
              </label>
              <input id={`project-nextMilestone-${project.id}`} name="nextMilestone" defaultValue={project.nextMilestone ?? ""} className="field" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`project-notes-${project.id}`} className="block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Notes
              </label>
              <textarea id={`project-notes-${project.id}`} name="notes" defaultValue={project.notes ?? ""} className="field min-h-[96px] resize-y" />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-ink">
                Save project
              </button>
            </div>
          </form>
        </details>
      </div>
    </li>
  );
}

export default async function ProjectsPage() {
  const userId = await resolveActiveUserId();
  const projects = await listProjects(userId);

  const active = projects.filter((project) => project.status !== "done");
  const done = projects.filter((project) => project.status === "done");
  const waitingCount = active.filter((project) => project.status === "waiting").length;
  const targetingCount = active.filter((project) => project.targetDate).length;
  const activeBuckets = new Set(active.map((project) => project.bucket).filter(Boolean)).size;

  return (
    <div className="space-y-10">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.75rem] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Projects
          </p>
          <h1 className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]" style={{ color: "var(--text)", letterSpacing: "-0.025em" }}>
            Projects
          </h1>
        </div>
        <p className="text-[0.8125rem] sm:max-w-[38rem] sm:text-right" style={{ color: "var(--text-muted)" }}>
          {active.length} active
          {activeBuckets > 0 ? ` · ${activeBuckets} bucket${activeBuckets === 1 ? "" : "s"}` : ""}
          {waitingCount > 0 ? ` · ${waitingCount} waiting` : " · clear next milestones"}
        </p>
      </header>

      <section className="fade-in-delay-1 grid gap-px overflow-hidden rounded-md border sm:grid-cols-2 xl:grid-cols-4" style={{ borderColor: "var(--border-faint)", background: "var(--border-faint)" }}>
        <MetricCard label="Active" value={String(active.length)} hint="projects still in motion" />
        <MetricCard label="Waiting" value={String(waitingCount)} hint="blocked or dependent on others" />
        <MetricCard label="Target dates" value={String(targetingCount)} hint="projects with a visible finish line" />
        <MetricCard label="Closed" value={String(done.length)} hint="finished loops worth remembering" />
      </section>

      <details
        className="rounded-md border px-4 py-3"
        style={{ borderColor: "var(--border-faint)", background: "var(--bg-page)" }}
      >
        <summary
          className="cursor-pointer list-none text-[0.75rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Project notes
        </summary>
        <div className="mt-3 space-y-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          <p>Use a project when the work needs an outcome, a next milestone, and linked tasks.</p>
          <p>Skip it when a single Do List item is enough.</p>
        </div>
      </details>

      <ProjectCreateForm />

      <SectionCard eyebrow="In motion" title="Current project stack.">
        {active.length === 0 ? (
          <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            No projects yet. Create one when the work needs more than a checklist.
          </p>
        ) : (
          <ol className="space-y-3">
            {active.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </ol>
        )}
      </SectionCard>

      <SectionCard eyebrow="Done" title="Finished project loops.">
        {done.length === 0 ? (
          <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            Nothing closed here yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {done.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="px-4 py-4" style={{ background: "var(--bg-page)" }}>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="mt-1 text-[1.5rem] font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.025em" }}>
        {value}
      </p>
      <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {hint}
      </p>
    </div>
  );
}
