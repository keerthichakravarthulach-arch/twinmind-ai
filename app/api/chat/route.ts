import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const transcript = body.transcript || "";
    const question = body.question || "";

    if (!question.trim()) {
      return NextResponse.json(
        { error: "Missing question" },
        { status: 400 }
      );
    }

    const prompt = `
You are a smart live meeting copilot.

The user clicked a live suggestion or asked a direct question.
Use the transcript context to give a detailed, practical, helpful answer.

Rules:
- Be specific to the transcript
- Be concise but useful
- Give actionable wording when appropriate
- Do not make up facts not supported by the transcript

Transcript:
${transcript}

User request:
${question}
`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Chat failed", details: raw },
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

    const answer = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json(
      { error: "Server error during chat" },
      { status: 500 }
    );
  }
}