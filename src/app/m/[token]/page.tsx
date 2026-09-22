import { notFound } from "next/navigation";
import {
  getManagerLinkByToken,
  getProject,
  listInbox,
  listPlans,
  listTasks,
  taskCounts,
} from "@/lib/db";
import { ManagerClient } from "@/components/manager-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ManagerPage({ params }: Props) {
  const { token } = await params;
  const link = getManagerLinkByToken(token);
  if (!link) notFound();

  const project = getProject(link.project_id);
  if (!project) notFound();

  const inbox = listInbox(project.id);
  const plans = listPlans(project.id);
  const tasks = listTasks(project.id);
  const counts = taskCounts(project.id);
  const aiEnabled = Boolean(process.env.OPENAI_API_KEY?.trim());

  return (
    <main className="flex flex-1 flex-col">
      <ManagerClient
        token={token}
        projectName={project.name}
        inbox={inbox}
        plans={plans}
        tasks={tasks}
        counts={counts}
        aiEnabled={aiEnabled}
      />
    </main>
  );
}
