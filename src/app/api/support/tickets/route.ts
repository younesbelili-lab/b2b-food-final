import { NextRequest, NextResponse } from "next/server";
import { createTicket, getCurrentClientUser, listTicketsByUser } from "@/lib/store";

export function GET() {
  const user = getCurrentClientUser();
  return NextResponse.json({ items: listTicketsByUser(user.id) });
}

export async function POST(request: NextRequest) {
  try {
    const user = getCurrentClientUser();
    const body = await request.json();
    const ticket = createTicket({
      userId: user.id,
      subject: body.subject,
      message: body.message,
    });
    return NextResponse.json({ item: ticket }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur creation ticket." },
      { status: 400 },
    );
  }
}
