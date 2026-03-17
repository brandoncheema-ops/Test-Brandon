"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectOption } from "@/components/ui/select";
import { uploadFile, parseUploadedFile } from "@/app/actions/uploads";

const FILE_CATEGORIES = [
  { value: "collections", label: "Collections Report" },
  { value: "monthly_statement", label: "Monthly Statement" },
  { value: "invoice", label: "Invoice" },
  { value: "support_doc", label: "Supporting Document" },
] as const;

type FileCategory = (typeof FILE_CATEGORIES)[number]["value"];

interface FileUploadZoneProps {
  monthRunId: string;
  isFinalized: boolean;
}

export function FileUploadZone({ monthRunId, isFinalized }: FileUploadZoneProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [category, setCategory] = useState<FileCategory>("collections");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPending, startUploadTransition] = useTransition();
  const [parsePending, startParseTransition] = useTransition();
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploaded" | "parsed" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<{
    collections: number;
    expenses: number;
    warnings: string[];
    errors: string[];
  } | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setStatus("idle");
      setMessage(null);
      setUploadedFileId(null);
      setParseResult(null);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setStatus("idle");
      setMessage(null);
      setUploadedFileId(null);
      setParseResult(null);
    }
  }, []);

  function handleUpload() {
    if (!selectedFile) return;

    setMessage(null);
    startUploadTransition(async () => {
      const formData = new FormData();
      formData.append("monthRunId", monthRunId);
      formData.append("category", category);
      formData.append("file", selectedFile);

      const result = await uploadFile(formData);
      if ("error" in result && result.error) {
        setStatus("error");
        setMessage(result.error);
      } else if (result.data) {
        setUploadedFileId(result.data.id);
        setStatus("uploaded");
        setMessage(`Uploaded ${selectedFile.name} successfully.`);
        router.refresh();
      }
    });
  }

  function handleParse() {
    if (!uploadedFileId) return;

    setMessage(null);
    startParseTransition(async () => {
      const result = await parseUploadedFile(uploadedFileId);
      if ("error" in result && result.error) {
        setStatus("error");
        setMessage(`Parse failed: ${result.error}`);
      } else if (result.data) {
        setStatus("parsed");
        setParseResult(result.data);
        setMessage(
          `Parsed ${result.data.collections} collection rows and ${result.data.expenses} expense rows.`
        );
        // Reset for next upload
        setSelectedFile(null);
        setUploadedFileId(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        router.refresh();
      }
    });
  }

  function handleReset() {
    setSelectedFile(null);
    setUploadedFileId(null);
    setStatus("idle");
    setMessage(null);
    setParseResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  if (isFinalized) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          This month is finalized. Reopen to upload new files.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground">Category</label>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as FileCategory)}
          className="w-56"
        >
          {FILE_CATEGORIES.map((cat) => (
            <SelectOption key={cat.value} value={cat.value}>
              {cat.label}
            </SelectOption>
          ))}
        </Select>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20 hover:border-muted-foreground/40 hover:bg-muted/40"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".csv,.xlsx,.xls,.pdf,.doc,.docx,.txt,.json"
        />
        <UploadCloudIcon className={dragActive ? "text-primary" : "text-muted-foreground"} />
        <p className="mt-3 text-sm font-medium text-foreground">
          {selectedFile ? selectedFile.name : "Drop a file here or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {selectedFile
            ? `${(selectedFile.size / 1024).toFixed(1)} KB`
            : "CSV, XLSX, PDF, or other supported formats"}
        </p>
      </div>

      {/* Action buttons */}
      {selectedFile && (
        <div className="flex items-center gap-2">
          {status === "idle" && (
            <Button
              size="sm"
              onClick={handleUpload}
              disabled={uploadPending}
            >
              {uploadPending ? (
                <>
                  <LoadingSpinner />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadIcon />
                  Upload File
                </>
              )}
            </Button>
          )}

          {status === "uploaded" && uploadedFileId && (
            <Button
              size="sm"
              onClick={handleParse}
              disabled={parsePending}
            >
              {parsePending ? (
                <>
                  <LoadingSpinner />
                  Parsing...
                </>
              ) : (
                <>
                  <FileSearchIcon />
                  Parse
                </>
              )}
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={handleReset}>
            Clear
          </Button>
        </div>
      )}

      {/* Status messages */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            status === "error"
              ? "border border-destructive/20 bg-destructive/5 text-destructive"
              : status === "parsed"
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          {message}
        </div>
      )}

      {/* Parse result details */}
      {parseResult && parseResult.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Warnings:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {parseResult.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function UploadCloudIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

function FileSearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <circle cx="11.5" cy="14.5" r="2.5" />
      <line x1="13.25" x2="15" y1="16.25" y2="18" />
    </svg>
  );
}
