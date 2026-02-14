"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Loader2,
  ArrowLeft,
  FileText,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KnowledgeCard } from "@/components/knowledge/knowledge-card";
import { DocumentUpload } from "@/components/knowledge/document-upload";
import { QueryTester } from "@/components/knowledge/query-tester";
import {
  api,
  type KnowledgeBase,
  type KBDocument,
} from "@/lib/api";

type ViewState =
  | { mode: "list" }
  | { mode: "detail"; kbId: string };

export default function KnowledgePage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<ViewState>({ mode: "list" });

  // Detail view state
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createModel, setCreateModel] = useState("text-embedding-3-small");
  const [createChunkSize, setCreateChunkSize] = useState(1000);
  const [createChunkOverlap, setCreateChunkOverlap] = useState(200);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchKnowledgeBases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.knowledgeBases.list();
      setKnowledgeBases(res.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load knowledge bases"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (kbId: string) => {
    setIsLoadingDetail(true);
    try {
      const [kb, docs] = await Promise.all([
        api.knowledgeBases.get(kbId),
        api.knowledgeBases.documents(kbId),
      ]);
      setSelectedKb(kb);
      setDocuments(docs);
    } catch {
      // fallback
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  useEffect(() => {
    if (view.mode === "detail") {
      fetchDetail(view.kbId);
    }
  }, [view, fetchDetail]);

  const handleCreate = async () => {
    if (!createName.trim()) {
      setCreateError("Name is required");
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      await api.knowledgeBases.create({
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        embedding_model: createModel,
        chunk_size: createChunkSize,
        chunk_overlap: createChunkOverlap,
      });
      setCreateOpen(false);
      resetCreateForm();
      fetchKnowledgeBases();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create knowledge base"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreateName("");
    setCreateDescription("");
    setCreateModel("text-embedding-3-small");
    setCreateChunkSize(1000);
    setCreateChunkOverlap(200);
    setCreateError(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.knowledgeBases.delete(id);
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
      if (view.mode === "detail" && view.kbId === id) {
        setView({ mode: "list" });
      }
    } catch {
      // silently fail for now
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!selectedKb) return;
    try {
      await api.knowledgeBases.deleteDocument(selectedKb.id, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      // silently fail
    }
  };

  // Detail view
  if (view.mode === "detail") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setView({ mode: "list" });
              fetchKnowledgeBases();
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {selectedKb?.name || "Knowledge Base"}
            </h2>
            {selectedKb?.description && (
              <p className="text-muted-foreground">
                {selectedKb.description}
              </p>
            )}
          </div>
        </div>

        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Documents</h3>
              <DocumentUpload
                knowledgeBaseId={view.kbId}
                onUploadComplete={() => fetchDetail(view.kbId)}
              />
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 rounded-md border p-3 text-sm"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{doc.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {doc.file_type && (
                            <span className="uppercase">{doc.file_type}</span>
                          )}
                          {doc.file_size_bytes && (
                            <span>
                              {(doc.file_size_bytes / 1024).toFixed(1)} KB
                            </span>
                          )}
                          <span>{doc.chunk_count} chunks</span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          doc.status === "ready"
                            ? "default"
                            : doc.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs shrink-0"
                      >
                        {doc.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Test Query</h3>
              <QueryTester knowledgeBaseId={view.kbId} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Knowledge</h2>
          <p className="text-muted-foreground">
            Manage knowledge bases for your agents.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Knowledge Base
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={fetchKnowledgeBases}
          >
            Retry
          </Button>
        </div>
      ) : knowledgeBases.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">
            No knowledge bases yet
          </h3>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            Upload documents and create knowledge bases for RAG-powered agents.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create Knowledge Base
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {knowledgeBases.map((kb) => (
            <KnowledgeCard
              key={kb.id}
              knowledgeBase={kb}
              onClick={(id) => setView({ mode: "detail", kbId: id })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!isCreating) {
            setCreateOpen(open);
            if (!open) resetCreateForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Knowledge Base</DialogTitle>
            <DialogDescription>
              Configure a new knowledge base for document storage and semantic
              search.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kb-name">Name</Label>
              <Input
                id="kb-name"
                placeholder="My Knowledge Base"
                value={createName}
                onChange={(e) => {
                  setCreateName(e.target.value);
                  setCreateError(null);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-description">Description (optional)</Label>
              <Textarea
                id="kb-description"
                placeholder="What kind of documents will this contain?"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-model">Embedding Model</Label>
              <Select value={createModel} onValueChange={setCreateModel}>
                <SelectTrigger id="kb-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text-embedding-3-small">
                    text-embedding-3-small
                  </SelectItem>
                  <SelectItem value="text-embedding-3-large">
                    text-embedding-3-large
                  </SelectItem>
                  <SelectItem value="text-embedding-ada-002">
                    text-embedding-ada-002
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Chunk Size: {createChunkSize}</Label>
              <Slider
                value={[createChunkSize]}
                onValueChange={([v]) => setCreateChunkSize(v)}
                min={100}
                max={4000}
                step={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Chunk Overlap: {createChunkOverlap}</Label>
              <Slider
                value={[createChunkOverlap]}
                onValueChange={([v]) => setCreateChunkOverlap(v)}
                min={0}
                max={1000}
                step={50}
              />
            </div>

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetCreateForm();
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !createName.trim()}
            >
              {isCreating && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
