import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file received" },
        { status: 400 }
      );
    }

    const groqForm = new FormData();
    groqForm.append("file", file, file.name);
    groqForm.append("model", "whisper-large-v3-turbo");
    groqForm.append("response_format", "json");

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: groqForm,
      }
    );

    const raw = await response.text();
    console.log("Groq raw response:", raw);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Transcription failed",
          details: raw,
          status: response.status,
        },
        { status: response.status }
      );
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Groq returned non-JSON", details: raw },
        { status: 500 }
      );
    }

    return NextResponse.json({
      text: data.text || "",
    });
  } catch (error) {
    console.error("Transcription route error:", error);
    return NextResponse.json(
      { error: "Server error during transcription" },
      { status: 500 }
    );
  }
}