import { createContext, useContext } from 'react'

export interface EssayPanel { task: string; prompt: string; time: number; minWords: number; maxWords: number }

export interface TodoItem {
  id: string
  time?: string
  task: string
  duration?: number
  subject?: string
  done: boolean
}

interface ChatContextValue {
  onOpenTest: (jsonStr: string) => void
  onProfileUpdate: (data: { weakTopics?: string[]; strongTopics?: string[] }) => void
  onOpenFlash: (jsonStr: string) => void
  onOpenEssay: (data: EssayPanel) => void
  onSetTodo: (items: Omit<TodoItem, 'id' | 'done'>[]) => void
  onMarkTodoDoneByTask: (taskName: string) => void
}

const ChatContext = createContext<ChatContextValue>({
  onOpenTest: () => {},
  onProfileUpdate: () => {},
  onOpenFlash: () => {},
  onOpenEssay: () => {},
  onSetTodo: () => {},
  onMarkTodoDoneByTask: () => {},
})

export const useChatContext = () => useContext(ChatContext)
export default ChatContext
