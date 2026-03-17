import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { readFile } from "fs/promises";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ monthRunId: string; filename: string }> }
) {
  const { monthRunId, filename } = await params;

  const artifact = await prisma.exportArtifact.findFirst({
    where: { monthRunId, filename },
  });

  if (!artifact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const content = await readFile(artifact.storagePath);
    const ext = filename.split(".").pop()?.toLowerCase();

    const contentType =
      ext === "csv"
        ? "text/csv"
        : ext === "pdf"
          ? "application/pdf"
          : "application/octet-stream";

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "File not found on disk" },
      { status: 404 }
    );
  }
}
