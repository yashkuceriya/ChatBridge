"use client";

import { useState, useMemo } from "react";
import { Plus, MessageSquare, PanelLeftClose, PanelLeft, Search, X, Trash2, Pencil, Check } from "lucide-react";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { UserMenu } from "./user-menu";

interface Conversation {
  id: string;
  title: string;
  createdAt?: string | Date;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation?: (id: string) => void;
  onRenameConversation?: (id: string, title: string) => void;
}

function groupConversationsByDate(conversations: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conv of conversations) {
    const date = conv.createdAt ? new Date(conv.createdAt) : null;
    if (!date) {
      groups[0].items.push(conv);
      continue;
    }
    if (date >= today) {
      groups[0].items.push(conv);
    } else if (date >= yesterday) {
      groups[1].items.push(conv);
    } else if (date >= weekAgo) {
      groups[2].items.push(conv);
    } else {
      groups[3].items.push(conv);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

export function Sidebar({
  isOpen,
  onToggle,
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const groupedConversations = useMemo(
    () => groupConversationsByDate(filteredConversations),
    [filteredConversations]
  );

  return (
    <>
      {/* Toggle button when closed */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            onClick={onToggle}
            className="fixed left-3 top-3 z-50 rounded-lg border border-zinc-800 bg-zinc-900/90 p-2 text-zinc-400 backdrop-blur-sm transition-colors duration-200 hover:border-zinc-700 hover:text-zinc-200"
          >
            <PanelLeft className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      <aside
        className={clsx(
          "flex h-screen w-64 flex-col border-r border-zinc-800/80 bg-zinc-950 transition-all duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full absolute"
        )}
      >
        {/* Header with gradient backdrop */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-600/5 to-transparent" />
          <div className="relative flex items-center justify-between p-3">
            <h1 className="text-lg font-bold">
              <span className="text-gradient-brand">ChatBridge</span>
            </h1>
            <button
              onClick={onToggle}
              className="rounded-lg p-1.5 text-zinc-500 transition-colors duration-200 hover:bg-zinc-800 hover:text-zinc-300"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pb-2">
          <button
            onClick={onNewConversation}
            className="flex w-full items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2.5 text-sm text-zinc-300 transition-all duration-200 hover:border-violet-600/30 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full rounded-lg border border-zinc-800/50 bg-zinc-900/50 py-2 pl-8 pr-8 text-xs text-zinc-300 placeholder-zinc-600 outline-none transition-all duration-200 focus:border-violet-600/30 focus:bg-zinc-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 pt-1">
          {groupedConversations.map((group) => (
            <div key={group.label} className="mb-3">
              <div className="px-3 py-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                  {group.label}
                </span>
              </div>
              {group.items.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => { if (editingId !== conv.id) onSelectConversation(conv.id); }}
                  className={clsx(
                    "group relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all duration-200 cursor-pointer",
                    activeId === conv.id
                      ? "border-l-2 border-l-violet-500 bg-zinc-800/80 pl-2.5 text-zinc-100"
                      : "border-l-2 border-l-transparent text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-300"
                  )}
                >
                  <MessageSquare className={clsx(
                    "h-3.5 w-3.5 shrink-0 transition-colors duration-200",
                    activeId === conv.id ? "text-violet-400" : "text-zinc-600 group-hover:text-zinc-400"
                  )} />

                  {editingId === conv.id ? (
                    <form
                      className="flex flex-1 items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editTitle.trim() && onRenameConversation) {
                          onRenameConversation(conv.id, editTitle.trim());
                        }
                        setEditingId(null);
                      }}
                    >
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => {
                          if (editTitle.trim() && onRenameConversation) {
                            onRenameConversation(conv.id, editTitle.trim());
                          }
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                        className="flex-1 bg-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-violet-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button type="submit" className="shrink-0 rounded p-0.5 text-green-400 hover:bg-zinc-700" onClick={(e) => e.stopPropagation()}>
                        <Check className="h-3 w-3" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{conv.title}</span>
                      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                        {onRenameConversation && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(conv.id);
                              setEditTitle(conv.title);
                            }}
                            className="rounded p-1 text-zinc-600 hover:bg-zinc-700 hover:text-zinc-300"
                            title="Rename"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        {onDeleteConversation && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(conv.id);
                            }}
                            className="rounded p-1 text-zinc-600 hover:bg-zinc-700 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}

          {filteredConversations.length === 0 && searchQuery && (
            <div className="px-3 py-8 text-center text-xs text-zinc-600">
              No conversations found
            </div>
          )}

          {conversations.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-zinc-600">
              No conversations yet
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800/80 p-3">
          <UserMenu />
        </div>
      </aside>
    </>
  );
}
