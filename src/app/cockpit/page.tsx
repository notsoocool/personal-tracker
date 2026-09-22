import { redirect } from "next/navigation";
import { isOwnerAuthenticated } from "@/lib/auth";
import {
  getActiveManagerLink,
  getActiveProject,
  listInbox,
  listPlans,
  listTasks,
  taskCounts,
} from "@/lib/db";
import { CockpitClient } from "@/components/cockpit-client";

export const dynamic = "force-dynamic";

export default async function CockpitPage() {
  if (!(await isOwnerAuthenticated())) {
    redirect("/login");
  }

  const project = getActiveProject();
  const link = getActiveManagerLink();
  const inbox = listInbox(project.id);
  const plans = listPlans(project.id);
  const tasks = listTasks(project.id);
  const counts = taskCounts(project.id);

  return (
    <main className="flex flex-1 flex-col">
      <CockpitClient
        projectName={project.name}
        managerPath={`/m/${link.token}`}
        inbox={inbox}
        plans={plans}
        tasks={tasks}
        counts={counts}
      />
    </main>
  );
}
