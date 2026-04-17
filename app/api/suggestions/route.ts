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

    if (!transcript.trim()) {
      return NextResponse.json({ suggestions: [] });
    }

    const prompt = `
You are a real-time AI meeting copilot.

Your goal is to help the user respond intelligently during a live conversation.

Based on the transcript, generate exactly 3 high-value suggestions.

Each suggestion must be different:
1. A smart question to ask next
2. A useful insight or interpretation
3. A concrete action or recommendation

Guidelines:
- Be specific to the conversation
- Avoid generic advice
- Focus on what helps the user respond better right now
- Keep title short and sharp
- Make preview immediately useful even if not clicked
- Return only valid JSON
- Do not include markdown or code fences

Return exactly this format:
{
  "suggestions": [
    {
      "id": "1",
      "type": "question",
      "title": "Short title",
      "preview": "Helpful preview"
    },
    {
      "id": "2",
      "type": "insight",
      "title": "Short title",
      "preview": "Helpful preview"
    },
    {
      "id": "3",
      "type": "action",
      "title": "Short title",
      "preview": "Helpful preview"
    }
  ]
}

Transcript:
${transcript}
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
        { error: "Suggestions failed", details: raw },
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

    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse model response", details: content },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Suggestions route error:", error);
    return NextResponse.json(
      { error: "Server error during suggestions" },
      { status: 500 }
    );
  }
}