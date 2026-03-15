import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "../../lib/azureSpeech";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { text, lang } = (await req.json()) as { text: string; lang?: "en" | "zh" };

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const truncated = text.slice(0, 1000);
    const audioBuffer = await synthesizeSpeech(truncated, lang ?? "en");

    return new NextResponse(audioBuffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
