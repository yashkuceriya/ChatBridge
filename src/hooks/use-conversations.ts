"use client";

import { useState, useCallback, useRef } from "react";

export interface Conversation {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DbMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  toolCalls?: unknown;
  appContext?: unknown;
  createdAt?: string;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  loading: boolean;
  loadConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation>;
  selectConversation: (id: string) => Promise<DbMessage[]>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
}

let localIdCounter = 0;

function generateLocalId(): string {
  localIdCounter += 1;
  return `local-${Date.now()}-${localIdCounter}`;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dbAvailable = useRef(true);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const fetched: Conversation[] = (data.conversations ?? []).map(
        (c: Record<string, unknown>) => ({
          id: c.id as string,
          title: (c.title as string) || "New Chat",
          createdAt: c.createdAt as string | undefined,
          updatedAt: c.updatedAt as string | undefined,
        })
      );
      setConversations(fetched);
      dbAvailable.current = true;
    } catch (err) {
      console.warn("Failed to load conversations from API, using local state:", err);
      dbAvailable.current = false;
      // Keep existing local state as-is
    } finally {
      setLoading(false);
    }
  }, []);

  const createConversation = useCallback(
    async (title?: string): Promise<Conversation> => {
      // Optimistically create a local conversation
      const localConv: Conversation = {
        id: generateLocalId(),
        title: title ?? "New Chat",
      };

      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title ?? "New Chat" }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const conv: Conversation = {
          id: data.conversation.id,
          title: data.conversation.title ?? "New Chat",
          createdAt: data.conversation.createdAt,
          updatedAt: data.conversation.updatedAt,
        };
        dbAvailable.current = true;
        setConversations((prev) => [conv, ...prev]);
        setActiveConversationId(conv.id);
        return conv;
      } catch (err) {
        console.warn("Failed to create conversation via API, using local:", err);
        dbAvailable.current = false;
        setConversations((prev) => [localConv, ...prev]);
        setActiveConversationId(localConv.id);
        return localConv;
      }
    },
    []
  );

  const selectConversation = useCallback(
    async (id: string): Promise<DbMessage[]> => {
      setActiveConversationId(id);

      // If it's a local-only conversation or DB is unavailable, return empty
      if (id.startsWith("local-") || !dbAvailable.current) {
        return [];
      }

      try {
        const res = await fetch(`/api/conversations/${id}/messages`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.messages ?? []) as DbMessage[];
      } catch (err) {
        console.warn("Failed to fetch messages for conversation:", err);
        return [];
      }
    },
    []
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<void> => {
      // Optimistically remove from state
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setActiveConversationId((prev) => (prev === id ? null : prev));

      if (id.startsWith("local-") || !dbAvailable.current) {
        return;
      }

      try {
        const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.warn("Failed to delete conversation via API:", err);
        // Already removed from local state; don't re-add on error
      }
    },
    []
  );

  const renameConversation = useCallback(
    async (id: string, title: string): Promise<void> => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );

      if (id.startsWith("local-") || !dbAvailable.current) return;

      try {
        await fetch(`/api/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
      } catch (err) {
        console.warn("Failed to rename conversation via API:", err);
      }
    },
    []
  );

  return {
    conversations,
    activeConversationId,
    loading,
    loadConversations,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
  };
}
