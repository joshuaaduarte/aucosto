import "server-only";

export type RiskLevel = "low" | "medium" | "high";

export interface ActionDef {
  action: string;
  risk: RiskLevel;
  confirmationRequired: boolean;
  supported: boolean;
  description: string;
}

export const ACTION_REGISTRY: Record<string, ActionDef> = {
  create_task: {
    action: "create_task",
    risk: "low",
    confirmationRequired: false,
    supported: true,
    description: "Create a new task/do item",
  },
  complete_task: {
    action: "complete_task",
    risk: "medium",
    confirmationRequired: true,
    supported: true,
    description: "Mark an existing task as done",
  },
  update_task: {
    action: "update_task",
    risk: "medium",
    confirmationRequired: true,
    supported: true,
    description: "Update task title, lane, or project",
  },
  create_calendar_block: {
    action: "create_calendar_block",
    risk: "medium",
    confirmationRequired: true,
    supported: true,
    description: "Add a planned calendar block",
  },
  start_timer: {
    action: "start_timer",
    risk: "medium",
    confirmationRequired: true,
    supported: true,
    description: "Start a new time entry",
  },
  stop_timer: {
    action: "stop_timer",
    risk: "medium",
    confirmationRequired: true,
    supported: true,
    description: "Stop the currently running timer",
  },
  edit_time_entry: {
    action: "edit_time_entry",
    risk: "medium",
    confirmationRequired: true,
    supported: true,
    description: "Edit a completed time entry's title or times",
  },
  log_habit: {
    action: "log_habit",
    risk: "low",
    confirmationRequired: false,
    supported: true,
    description: "Log progress or completion for a habit",
  },
  add_reflection: {
    action: "add_reflection",
    risk: "low",
    confirmationRequired: false,
    supported: true,
    description: "Add or update today's reflection note and mood",
  },
  update_project: {
    action: "update_project",
    risk: "medium",
    confirmationRequired: true,
    supported: true,
    description: "Update project status or notes",
  },
  finance_write: {
    action: "finance_write",
    risk: "high",
    confirmationRequired: true,
    supported: false,
    description: "Finance write operations (not yet supported)",
  },

  // Project planning actions
  update_project_plan: {
    action: "update_project_plan",
    risk: "medium",
    confirmationRequired: true,
    supported: true,
    description: "Update project planning fields (goal, next action, milestone, notes)",
  },
  add_project_milestone: {
    action: "add_project_milestone",
    risk: "low",
    confirmationRequired: false,
    supported: true,
    description: "Set or update the project's next milestone",
  },
  add_project_question: {
    action: "add_project_question",
    risk: "low",
    confirmationRequired: false,
    supported: true,
    description: "Add an open question to a project",
  },
  add_project_blocker: {
    action: "add_project_blocker",
    risk: "low",
    confirmationRequired: false,
    supported: true,
    description: "Add a blocker to a project",
  },
  set_project_next_action: {
    action: "set_project_next_action",
    risk: "low",
    confirmationRequired: false,
    supported: true,
    description: "Set the next concrete action for a project",
  },

  // Rolodex actions
  create_rolodex_person: {
    action: "create_rolodex_person",
    risk: "low",
    confirmationRequired: false,
    supported: true,
    description: "Create a new contact in the Rolodex",
  },
  update_rolodex_person: {
    action: "update_rolodex_person",
    risk: "medium",
    confirmationRequired: true,
    supported: true,
    description: "Update a contact's details in the Rolodex",
  },
  add_rolodex_interaction: {
    action: "add_rolodex_interaction",
    risk: "low",
    confirmationRequired: false,
    supported: true,
    description: "Log an interaction with a Rolodex contact",
  },
  add_person_followup: {
    action: "add_person_followup",
    risk: "low",
    confirmationRequired: false,
    supported: true,
    description: "Add a follow-up reminder for a Rolodex contact",
  },
  add_gift_idea: {
    action: "add_gift_idea",
    risk: "low",
    confirmationRequired: false,
    supported: true,
    description: "Add a gift idea for a Rolodex contact",
  },
};
