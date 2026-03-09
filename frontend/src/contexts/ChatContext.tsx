import { createContext, useContext } from 'react'

export interface EssayPanel { task: string; prompt: string; time: number; minWords: number; maxWords: number }

interface ChatContextValue {
  onOpenTest: (jsonStr: string) => void
  onProfileUpdate: (data: { weakTopics?: string[]; strongTopics?: string[] }) => void
  onOpenFlash: (jsonStr: string) => void
  onOpenEssay: (data: EssayPanel) => void
}

const ChatContext = createContext<ChatContextValue>({
  onOpenTest: () => {},
  onProfileUpdate: () => {},
  onOpenFlash: () => {},
  onOpenEssay: () => {},
})

export const useChatContext = () => useContext(ChatContext)
export default ChatContext
