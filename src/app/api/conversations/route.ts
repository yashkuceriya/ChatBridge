import { NextRequest, NextResponse } from "next/server";
import { createConversation, getConversations } from "@/lib/db/queries";

// Seeded demo user UUID — replace with auth session user ID in production
const DEFAULT_USER_ID = "b24fc886-d557-40dd-bccc-3bd34c1d77cf";

export async function GET() {
  try {
    const conversations = await getConversations(DEFAULT_USER_ID);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title } = body;
    const conversation = await createConversation(DEFAULT_USER_ID, title);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
