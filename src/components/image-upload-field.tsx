"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

export function ImageUploadField({ label }: { label: string }) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  );

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div className="image-upload">
      <label className="upload-field">
        <input
          type="file"
          ref={inputRef}
          name="image"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {preview ? (
          <span
            className="upload-preview"
            style={{ backgroundImage: `url("${preview}")` }}
            role="img"
            aria-label="Selected image preview"
          />
        ) : (
          <ImagePlus size={24} />
        )}
        <span>
          <strong>{file?.name ?? label}</strong>
          <small>
            {file
              ? `${(file.size / (1024 * 1024)).toFixed(2)} MB selected`
              : "PNG, JPG or WebP · max 5 MB"}
          </small>
        </span>
      </label>
      {file && (
        <button
          className="button button-quiet upload-clear"
          type="button"
          onClick={() => {
            if (inputRef.current) inputRef.current.value = "";
            setFile(null);
          }}
        >
          <X size={16} /> Clear selection
        </button>
      )}
    </div>
  );
}
