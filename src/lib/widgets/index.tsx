import { TimeTrackerWidget } from "./time-tracker";
import { FinanceWidget } from "./finance";

export type WidgetDescriptor = {
  id: string;
  name: string;
  href: string;
  Widget: () => Promise<React.ReactNode> | React.ReactNode;
};

export const widgets: WidgetDescriptor[] = [
  {
    id: "time",
    name: "Time tracker",
    href: "/app/time",
    Widget: TimeTrackerWidget,
  },
  {
    id: "finance",
    name: "Finance",
    href: "/app/finance",
    Widget: FinanceWidget,
  },
];
