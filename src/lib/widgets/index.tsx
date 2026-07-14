import { ActivityWidget } from "./activity";
import { CalendarWidget } from "./calendar";
import { DoWidget } from "./do";
import { HabitsWidget } from "./habits";
import { TimeTrackerWidget } from "./time-tracker";
import { FinanceWidget } from "./finance";
import { WorkWidget } from "./work";

export type WidgetDescriptor = {
  id: string;
  name: string;
  href: string;
  Widget: () => Promise<React.ReactNode> | React.ReactNode;
};

export const widgets: WidgetDescriptor[] = [
  {
    id: "calendar",
    name: "Calendar",
    href: "/app/calendar",
    Widget: CalendarWidget,
  },
  {
    id: "time",
    name: "Time tracker",
    href: "/app/time",
    Widget: TimeTrackerWidget,
  },
  {
    id: "do",
    name: "Do List",
    href: "/app/do",
    Widget: DoWidget,
  },
  {
    id: "work",
    name: "Work",
    href: "/app/work",
    Widget: WorkWidget,
  },
  {
    id: "habits",
    name: "Habits",
    href: "/app/habits",
    Widget: HabitsWidget,
  },
  {
    id: "finance",
    name: "Finance",
    href: "/app/finance",
    Widget: FinanceWidget,
  },
  {
    id: "activity",
    name: "Activity",
    href: "/app",
    Widget: ActivityWidget,
  },
];
