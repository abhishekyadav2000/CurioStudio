import { NextRequest, NextResponse } from "next/server";
import {
  createOutreachBatch,
  listOutreachBatches,
  getOutreachBatch,
  updateOutreachBatch,
  createContentProjectForBatch,
} from "@/lib/leads/outreach-batch";
import type { OutreachBatchStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    const batch = await getOutreachBatch(id);
    if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ batch });
  }
  const batches = await listOutreachBatches();
  return NextResponse.json({ batches });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    name,
    contactIds = [],
    leadIds = [],
    scheduledFor,
    meetingDate,
    meetingAttendees,
    notes,
    action,
    batchId,
  } = body as {
    name?: string;
    contactIds?: string[];
    leadIds?: string[];
    scheduledFor?: string;
    meetingDate?: string;
    meetingAttendees?: string[];
    notes?: string;
    action?: string;
    batchId?: string;
  };

  try {
    if (action === "createContent" && batchId) {
      const result = await createContentProjectForBatch(batchId);
      return NextResponse.json(result, { status: 201 });
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!contactIds.length && !leadIds.length) {
      return NextResponse.json({ error: "Select at least one contact or lead" }, { status: 400 });
    }

    const batch = await createOutreachBatch({
      name: name.trim(),
      contactIds,
      leadIds,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      meetingDate: meetingDate ? new Date(meetingDate) : undefined,
      meetingAttendees,
      notes,
    });
    return NextResponse.json({ batch }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create batch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, name, status, scheduledFor, meetingDate, meetingAttendees, notes } = body as {
    id: string;
    name?: string;
    status?: OutreachBatchStatus;
    scheduledFor?: string | null;
    meetingDate?: string | null;
    meetingAttendees?: string[];
    notes?: string;
  };

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const batch = await updateOutreachBatch(id, {
      name,
      status,
      scheduledFor: scheduledFor === null ? null : scheduledFor ? new Date(scheduledFor) : undefined,
      meetingDate: meetingDate === null ? null : meetingDate ? new Date(meetingDate) : undefined,
      meetingAttendees,
      notes,
    });
    return NextResponse.json({ batch });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
