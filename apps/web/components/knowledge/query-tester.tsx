"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api, type QueryResult } from "@/lib/api";

interface QueryTesterProps {
  knowledgeBaseId: string;
}

export function QueryTester({ knowledgeBaseId }: QueryTesterProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await api.knowledgeBases.query(
        knowledgeBaseId,
        query.trim()
      );
      setResults(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Textarea
          placeholder="Type a question to test semantic search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={2}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSearch();
            }
          }}
        />
        <Button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {hasSearched && !isLoading && results.length === 0 && !error && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No results found. Make sure documents have been processed.
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </p>
          {results.map((result, idx) => (
            <div
              key={result.chunk_id}
              className="rounded-md border p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Chunk #{result.chunk_index + 1}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {(result.similarity * 100).toFixed(1)}% match
                </Badge>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {result.content.length > 500
                  ? result.content.slice(0, 500) + "..."
                  : result.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
