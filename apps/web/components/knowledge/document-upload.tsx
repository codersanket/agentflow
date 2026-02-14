"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type DocumentUploadResponse } from "@/lib/api";

interface DocumentUploadProps {
  knowledgeBaseId: string;
  onUploadComplete?: () => void;
}

interface UploadItem {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  result?: DocumentUploadResponse;
  error?: string;
}

const ALLOWED_EXTENSIONS = [".txt", ".md", ".csv", ".pdf", ".docx"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUpload({
  knowledgeBaseId,
  onUploadComplete,
}: DocumentUploadProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (files: File[]) => {
      const validFiles = files.filter((f) => {
        const ext = "." + f.name.split(".").pop()?.toLowerCase();
        return ALLOWED_EXTENSIONS.includes(ext);
      });

      if (validFiles.length === 0) return;

      const newUploads: UploadItem[] = validFiles.map((file) => ({
        file,
        status: "pending" as const,
      }));

      setUploads((prev) => [...prev, ...newUploads]);

      // Upload files sequentially
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: "uploading" } : u
          )
        );

        try {
          const result = await api.knowledgeBases.uploadDocument(
            knowledgeBaseId,
            file
          );
          setUploads((prev) =>
            prev.map((u) =>
              u.file === file ? { ...u, status: "done", result } : u
            )
          );
        } catch (err) {
          setUploads((prev) =>
            prev.map((u) =>
              u.file === file
                ? {
                    ...u,
                    status: "error",
                    error:
                      err instanceof Error ? err.message : "Upload failed",
                  }
                : u
            )
          );
        }
      }

      onUploadComplete?.();
    },
    [knowledgeBaseId, onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      addFiles(files);
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      addFiles(files);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [addFiles]
  );

  const removeUpload = (file: File) => {
    setUploads((prev) => prev.filter((u) => u.file !== file));
  };

  return (
    <div className="space-y-3">
      <div
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Drag and drop files here, or{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => fileInputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Supports: {ALLOWED_EXTENSIONS.join(", ")}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={handleFileSelect}
        />
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, idx) => (
            <div
              key={`${upload.file.name}-${idx}`}
              className="flex items-center gap-3 rounded-md border p-2 text-sm"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{upload.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(upload.file.size)}
                </p>
              </div>
              {upload.status === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              )}
              {upload.status === "done" && (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              )}
              {upload.status === "error" && (
                <Badge variant="destructive" className="text-xs shrink-0">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Failed
                </Badge>
              )}
              {upload.status === "pending" && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Queued
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeUpload(upload.file)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
