import { ProjectForm } from "@/components/admin/ProjectForm";

export default function NewProjectPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">New project</h1>
      <p className="text-slate-500 text-sm mb-6">
        Set up a delivery/installation project. Add locations next.
      </p>
      <ProjectForm />
    </div>
  );
}
