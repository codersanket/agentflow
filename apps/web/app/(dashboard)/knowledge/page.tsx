import { BookOpen } from "lucide-react";

export default function KnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Knowledge</h2>
        <p className="text-muted-foreground">
          Manage knowledge bases for your agents.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <BookOpen className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No knowledge bases yet</h3>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          Upload documents and create knowledge bases for RAG-powered agents.
        </p>
      </div>
    </div>
  );
}
