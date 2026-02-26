import OpenAI from "openai"
import { prisma } from "@/lib/db/prisma"

export async function getAIClient() {
  const config = await prisma.aIConfig.findFirst()
  if (!config) throw new Error("AI config not found. Please configure in admin panel.")

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  })
}

export async function getAIConfig() {
  const config = await prisma.aIConfig.findFirst()
  if (!config) throw new Error("AI config not found.")
  return config
}
