import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// This acts as a proxy for any OpenAI-compatible API (deepseek or chatgpt)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy_key",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
});

export async function POST(req: NextRequest) {
  try {
    const { messages, topicContext } = await req.json();

    // Here we would normally plug into a Vector Database to retrieve RAG documents based on `messages[last].content`
    // For this prototype, we simulate RAG by injecting system context.
    const systemMessage = {
      role: 'system',
      content: `You are an AI Tutor preparing a student for the Uzbekistan National Certificate exam.
      The student has recently struggled with: "${topicContext || 'General topics'}".
      Respond clearly in Uzbek, keeping it simple. Do not use overly complex terminology.
      Provide examples. If they ask about a specific rule, quote the rule accurately.`
    };

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "gpt-3.5-turbo",
      messages: [systemMessage, ...messages],
      stream: false,
    });

    return NextResponse.json({
      role: 'assistant',
      content: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'AI Tutor is currently unavailable.' }, { status: 500 });
  }
}
