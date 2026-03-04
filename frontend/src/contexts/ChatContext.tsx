import { createContext, useContext } from 'react'

interface ChatContextValue {
  onOpenTest: (jsonStr: string) => void
  onProfileUpdate: (data: { weakTopics?: string[]; strongTopics?: string[] }) => void
  onOpenFlash: (jsonStr: string) => void
}

const ChatContext = createContext<ChatContextValue>({
  onOpenTest: () => {},
  onProfileUpdate: () => {},
  onOpenFlash: () => {},
})

export const useChatContext = () => useContext(ChatContext)
export default ChatContext
