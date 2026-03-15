export async function synthesizeSpeech(text: string, lang: "en" | "zh" = "en"): Promise<Buffer> {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    throw new Error("Azure Speech environment variables are not configured.");
  }

  const voiceName = lang === "zh" ? "zh-CN-XiaoxiaoNeural" : "en-US-JennyNeural";
  const xmlLang  = lang === "zh" ? "zh-CN" : "en-US";
  const escaped  = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const ssml = `
    <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${xmlLang}'>
      <voice name='${voiceName}'>
        <prosody rate='0%' pitch='0%'>${escaped}</prosody>
      </voice>
    </speak>
  `;

  // Use the API key directly — avoids a separate token exchange roundtrip
  const ttsEndpoint = `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ttsResponse = await fetch(ttsEndpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": speechKey,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
      "User-Agent": "KeyReplyPatientComplaints",
    },
    body: ssml,
  });

  if (!ttsResponse.ok) {
    const errText = await ttsResponse.text();
    throw new Error(`TTS request failed: ${ttsResponse.statusText} - ${errText}`);
  }

  const arrayBuffer = await ttsResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function transcribeAudio(
  audioBlob: Buffer<ArrayBufferLike>,
  contentType: string,
  lang = "en-US"
): Promise<{ transcript: string; latency_ms: number }> {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    throw new Error("Azure Speech environment variables are not configured.");
  }

  const startTime = Date.now();

  const endpoint = `https://${speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${lang}&format=detailed`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": speechKey,
      "Content-Type": contentType || "audio/wav",
      Accept: "application/json",
    },
    body: audioBlob.buffer as ArrayBuffer,
  });

  const latency_ms = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`STT request failed: ${response.statusText} - ${errText}`);
  }

  const result = await response.json() as {
    RecognitionStatus: string;
    NBest?: Array<{ Display: string }>;
    DisplayText?: string;
  };

  if (result.RecognitionStatus !== "Success") {
    throw new Error(`STT recognition failed: ${result.RecognitionStatus}`);
  }

  const transcript =
    result.NBest?.[0]?.Display || result.DisplayText || "";

  return { transcript, latency_ms };
}
