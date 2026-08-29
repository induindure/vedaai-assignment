import { NextRequest, NextResponse } from "next/server";
import { ReportRequestSchema, buildReportFilename, generateReportPdf } from "@/lib/generateReport";

// pdf-lib is pure JS — no native bindings — so unlike /api/process this route has no reason
// to be pinned to the Node.js runtime specifically, but nodejs is the default anyway and
// keeps behavior consistent (Buffer, etc.) with the rest of the API surface.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  }

  const parsed = ReportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Request body is missing or has malformed report data." }, { status: 400 });
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateReportPdf(parsed.data);
  } catch (error) {
    console.error("Failed to generate report PDF:", error);
    return NextResponse.json({ error: "Failed to generate the report." }, { status: 500 });
  }

  const filename = buildReportFilename(parsed.data.studentName ?? null);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
