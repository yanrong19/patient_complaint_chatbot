import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "../../lib/azureSpeech";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "audio/wav";
    const arrayBuffer = await req.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json(
        { error: "No audio data received" },
        { status: 400 }
      );
    }

    const lang = req.nextUrl.searchParams.get("lang") ?? "en-US";
    const { transcript, latency_ms } = await transcribeAudio(
      audioBuffer as Buffer<ArrayBufferLike>,
      contentType,
      lang
    );

    return NextResponse.json({ transcript, latency_ms });
  } catch (err) {
    const message = err instanceof Error ? err.message : "STT failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
