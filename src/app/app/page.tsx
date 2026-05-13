import { auth } from "@/auth";
import { widgets } from "@/lib/widgets";

export default async function HubPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {firstName ? `Hey, ${firstName}.` : "Welcome back."}
        </h1>
        <p className="mt-2 text-zinc-500">Your hub.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {widgets.map(({ id, Widget }) => (
          <Widget key={id} />
        ))}
      </div>
    </div>
  );
}
