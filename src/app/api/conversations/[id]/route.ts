import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  deleteConversation,
  updateConversationTitle,
} from "@/lib/db/queries";
import { getMessages } from "@/lib/db/queries";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function getAuthUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id || null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const conversation = await getConversation(id);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (conversation.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const messages = await getMessages(id);
    return NextResponse.json({ conversation, messages });
  } catch (error) {
    console.error("Failed to fetch conversation:", error);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const conversation = await getConversation(id);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (conversation.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await deleteConversation(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete conversation:", error);
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const conversation = await getConversation(id);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (conversation.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = await updateConversationTitle(id, title);
    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error("Failed to update conversation:", error);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}
