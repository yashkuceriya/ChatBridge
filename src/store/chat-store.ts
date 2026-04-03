import { create } from "zustand";
import type { Message, AppSession, Conversation } from "@/types";

interface ChatState {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;

  // Messages
  messages: Message[];
  isStreaming: boolean;

  // App sessions
  appSessions: Map<string, AppSession>;
  activeAppSessionId: string | null;

  // Sidebar
  sidebarOpen: boolean;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setMessages: (messages: Message[]) => void;
  setIsStreaming: (streaming: boolean) => void;
  setAppSession: (session: AppSession) => void;
  removeAppSession: (sessionId: string) => void;
  setActiveAppSession: (sessionId: string | null) => void;
  toggleSidebar: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  appSessions: new Map(),
  activeAppSessionId: null,
  sidebarOpen: true,

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),
  setMessages: (messages) => set({ messages }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setAppSession: (session) =>
    set((state) => {
      const sessions = new Map(state.appSessions);
      sessions.set(session.id, session);
      return { appSessions: sessions };
    }),
  removeAppSession: (sessionId) =>
    set((state) => {
      const sessions = new Map(state.appSessions);
      sessions.delete(sessionId);
      return { appSessions: sessions };
    }),
  setActiveAppSession: (sessionId) => set({ activeAppSessionId: sessionId }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  reset: () =>
    set({
      messages: [],
      isStreaming: false,
      appSessions: new Map(),
      activeAppSessionId: null,
    }),
}));
