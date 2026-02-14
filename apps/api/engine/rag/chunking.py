from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ChunkMetadata:
    chunk_index: int
    start_char: int = 0
    end_char: int = 0


@dataclass
class Chunk:
    content: str
    metadata: ChunkMetadata


class RecursiveCharacterSplitter:
    """Splits text into chunks by paragraph, then sentence, then character boundaries."""

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._separators = ["\n\n", "\n", ". ", " ", ""]

    def split(self, text: str) -> list[Chunk]:
        if not text.strip():
            return []

        raw_chunks = self._split_recursive(text, self._separators)
        merged = self._merge_chunks(raw_chunks)

        chunks: list[Chunk] = []
        offset = 0
        for i, content in enumerate(merged):
            start = text.find(content, offset)
            if start == -1:
                start = offset
            chunks.append(
                Chunk(
                    content=content,
                    metadata=ChunkMetadata(
                        chunk_index=i,
                        start_char=start,
                        end_char=start + len(content),
                    ),
                )
            )
            offset = start + 1

        return chunks

    def _split_recursive(self, text: str, separators: list[str]) -> list[str]:
        if len(text) <= self.chunk_size:
            return [text.strip()] if text.strip() else []

        if not separators:
            # Hard split by character limit
            pieces: list[str] = []
            for i in range(0, len(text), self.chunk_size):
                piece = text[i : i + self.chunk_size].strip()
                if piece:
                    pieces.append(piece)
            return pieces

        separator = separators[0]
        remaining_separators = separators[1:]

        if not separator:
            return self._split_recursive(text, remaining_separators)

        parts = text.split(separator)
        result: list[str] = []
        for part in parts:
            part = part.strip()
            if not part:
                continue
            if len(part) <= self.chunk_size:
                result.append(part)
            else:
                result.extend(self._split_recursive(part, remaining_separators))

        return result

    def _merge_chunks(self, pieces: list[str]) -> list[str]:
        if not pieces:
            return []

        merged: list[str] = []
        current = pieces[0]

        for piece in pieces[1:]:
            candidate = current + " " + piece
            if len(candidate) <= self.chunk_size:
                current = candidate
            else:
                merged.append(current)
                # Apply overlap: take the tail of current chunk
                if self.chunk_overlap > 0 and len(current) > self.chunk_overlap:
                    overlap_text = current[-self.chunk_overlap :]
                    # Find a word boundary in the overlap
                    space_idx = overlap_text.find(" ")
                    if space_idx != -1:
                        overlap_text = overlap_text[space_idx + 1 :]
                    current = overlap_text + " " + piece
                else:
                    current = piece

        if current.strip():
            merged.append(current)

        return merged
