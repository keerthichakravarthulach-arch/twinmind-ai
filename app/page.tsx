"use client";

import { useRef, useState } from "react";

type TranscriptItem = {
  text: string;
  timestamp: string;
};

type Suggestion = {
  id: string;
  title: string;
  preview: string;
  type: string;
};

type SuggestionBatch = {
  id: string;
  timestamp: string;
  suggestions: Suggestion[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>(
    []
  );
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isProcessingChunkRef = useRef(false);
  const transcriptPanelRef = useRef<HTMLDivElement | null>(null);

  const scrollTranscriptToBottom = () => {
    setTimeout(() => {
      if (transcriptPanelRef.current) {
        transcriptPanelRef.current.scrollTop =
          transcriptPanelRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleExport = () => {
    const data = {
      transcript,
      suggestions: suggestionBatches,
      chat,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `twinmind-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateSuggestions = async (updatedTranscript: TranscriptItem[]) => {
    try {
      const recentText = updatedTranscript
        .slice(-5)
        .map((item) => item.text)
        .join("\n");

      if (!recentText.trim()) return;

      const suggestionRes = await fetch("/api/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: recentText,
        }),
      });

      const rawSuggestionText = await suggestionRes.text();

      let suggestionData: any;
      try {
        suggestionData = JSON.parse(rawSuggestionText);
      } catch {
        console.error(
          "Suggestions did not return valid JSON:",
          rawSuggestionText
        );
        return;
      }

      if (!suggestionRes.ok) {
        console.error(
          "Suggestions failed:",
          suggestionData?.error,
          suggestionData?.details
        );
        return;
      }

      if (suggestionData.suggestions) {
        setSuggestionBatches((prev) => [
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            suggestions: suggestionData.suggestions,
          },
          ...prev,
        ]);
      }
    } catch (error) {
      console.error("Suggestions generation error:", error);
    }
  };

  const processAudioBlob = async (audioBlob: Blob) => {
    if (isProcessingChunkRef.current) return;
    if (!audioBlob || audioBlob.size === 0) return;

    try {
      isProcessingChunkRef.current = true;

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const rawTranscribeText = await transcribeRes.text();

      let transcribeData: any;
      try {
        transcribeData = JSON.parse(rawTranscribeText);
      } catch {
        console.error(
          "Transcription did not return valid JSON:",
          rawTranscribeText
        );
        return;
      }

      if (!transcribeRes.ok) {
        console.error(
          "Transcription failed:",
          transcribeData?.error,
          transcribeData?.details
        );
        return;
      }

      if (transcribeData.text && transcribeData.text.trim()) {
        const newEntry: TranscriptItem = {
          text: transcribeData.text,
          timestamp: new Date().toISOString(),
        };

        setTranscript((prev) => {
          const updatedTranscript = [...prev, newEntry];
          generateSuggestions(updatedTranscript);
          scrollTranscriptToBottom();
          return updatedTranscript;
        });
      }
    } catch (error) {
      console.error("Chunk processing error:", error);
    } finally {
      isProcessingChunkRef.current = false;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          await processAudioBlob(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
      };

      mediaRecorder.start(30000);
      setRecording(true);
    } catch (error) {
      console.error("Microphone error:", error);
    }
  };

  const stopRecording = () => {
    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder || mediaRecorder.state === "inactive") return;

    mediaRecorder.stop();
    setRecording(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const sendChatQuestion = async (question: string) => {
    if (!question.trim()) return;

    try {
      setLoadingChat(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
        timestamp: new Date().toISOString(),
      };

      setChat((prev) => [...prev, userMessage]);

      const transcriptText = transcript.map((item) => item.text).join("\n");

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: transcriptText,
          question,
        }),
      });

      const rawText = await response.text();

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error("Chat did not return valid JSON:", rawText);
        return;
      }

      if (!response.ok) {
        console.error("Chat failed:", data?.error, data?.details);
        return;
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer || "No answer returned.",
        timestamp: new Date().toISOString(),
      };

      setChat((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSuggestionClick = async (suggestion: Suggestion) => {
    await sendChatQuestion(suggestion.preview);
  };

  const handleSendChat = async () => {
    const question = chatInput.trim();
    if (!question) return;

    setChatInput("");
    await sendChatQuestion(question);
  };

  const handleRefresh = async () => {
    await generateSuggestions(transcript);
  };

  return (
    <div className="relative h-screen">
      <button
        onClick={recording ? stopRecording : startRecording}
        className="absolute left-4 top-4 z-10 rounded bg-blue-600 px-4 py-2 text-white"
      >
        {recording ? "Stop Mic" : "Start Mic"}
      </button>

      <button
        onClick={handleExport}
        className="absolute left-36 top-4 z-10 rounded bg-green-600 px-4 py-2 text-white"
      >
        Export
      </button>

      <button
        onClick={handleRefresh}
        className="absolute left-64 top-4 z-10 rounded bg-purple-600 px-4 py-2 text-white"
      >
        Refresh
      </button>

      <div className="flex h-full">
        <div
          ref={transcriptPanelRef}
          className="w-1/3 overflow-y-auto border-r p-4 pt-20"
        >
          <h2 className="mb-3 text-lg font-bold">Transcript</h2>

          {transcript.length === 0 ? (
            <p className="text-sm text-gray-500">No transcript yet.</p>
          ) : (
            transcript.map((item, index) => (
              <div key={index} className="mb-4">
                <p className="text-xs text-gray-500">
                  {new Date(item.timestamp).toLocaleTimeString("en-US")}
                </p>
                <p className="mt-1">{item.text}</p>
              </div>
            ))
          )}
        </div>

        <div className="w-1/3 overflow-y-auto border-r p-4 pt-20">
          <h2 className="mb-3 text-lg font-bold">Suggestions</h2>
          <p className="mb-2 text-xs text-gray-400">
            Showing suggestions based on recent conversation
          </p>

          {suggestionBatches.length === 0 ? (
            <p className="text-sm text-gray-500">No suggestions yet.</p>
          ) : (
            suggestionBatches.map((batch) => (
              <div key={batch.id} className="mb-6">
                <p className="mb-2 text-xs text-gray-500">
                  {new Date(batch.timestamp).toLocaleTimeString("en-US")}
                </p>

                <div className="space-y-3">
                  {batch.suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full rounded border p-3 text-left hover:bg-gray-50"
                    >
                      <p className="font-semibold">{suggestion.title}</p>
                      <p className="text-sm text-gray-600">
                        {suggestion.preview}
                      </p>
                      <p className="mt-1 text-xs font-medium text-blue-600">
                        {suggestion.type.toUpperCase()}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex w-1/3 flex-col p-4 pt-20">
          <h2 className="mb-3 text-lg font-bold">Chat</h2>

          <div className="flex-1 overflow-y-auto">
            {chat.length === 0 ? (
              <p className="text-sm text-gray-500">No chat yet.</p>
            ) : (
              <div className="space-y-4">
                {chat.map((message) => (
                  <div key={message.id} className="rounded border p-3">
                    <p className="text-xs text-gray-500">
                      {message.role} •{" "}
                      {new Date(message.timestamp).toLocaleTimeString("en-US")}
                    </p>
                    <p className="mt-1">{message.content}</p>
                  </div>
                ))}
              </div>
            )}

            {loadingChat && (
              <p className="mt-3 text-sm text-gray-500">
                Generating answer...
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-2 border-t pt-4">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSendChat();
                }
              }}
              placeholder="Ask a question..."
              className="flex-1 rounded border px-3 py-2"
            />
            <button
              onClick={handleSendChat}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}