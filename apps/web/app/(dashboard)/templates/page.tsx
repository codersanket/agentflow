import { LayoutTemplate } from "lucide-react";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Templates</h2>
        <p className="text-muted-foreground">
          Browse pre-built agent templates to get started quickly.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <LayoutTemplate className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No templates yet</h3>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          Templates will be available soon.
        </p>
      </div>
    </div>
  );
}
