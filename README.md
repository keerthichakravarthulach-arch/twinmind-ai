# TwinMind Live Suggestions App

## Overview
This project is a real-time AI meeting assistant that listens to live audio, generates a transcript, and surfaces useful suggestions during a conversation. Users can click suggestions to get detailed responses or ask follow-up questions through chat.

## Features
- Live microphone recording
- Speech-to-text transcription using Groq Whisper
- Context-aware suggestions based on recent transcript
- Clickable suggestions that expand into detailed answers
- Chat interface for follow-up questions
- Export full session data as JSON
- Refresh button for regenerating suggestions
- 30-second chunk-based transcript updates

## Tech Stack
- Next.js (App Router)
- React
- Groq API (Whisper + GPT model)
- MediaRecorder API

## How It Works
Audio is recorded in chunks and sent for transcription. The most recent part of the transcript is used to generate three suggestions. These suggestions are designed to help the user respond during a live conversation. Clicking a suggestion generates a more detailed response using the full transcript context.

## Setup
1. Clone the repository
2. Install dependencies:
   npm install
3. Create a `.env.local` file:
   GROQ_API_KEY=your_api_key_here
4. Run the app:
   npm run dev

## Notes
- The app uses chunked recording instead of full streaming to keep implementation simple
- Sessions reset on refresh (no persistence)

## Future Improvements
- Real-time streaming transcription
- Better ranking of suggestions
- UI improvements
- Session persistence