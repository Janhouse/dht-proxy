import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getMemoryStats } from "@/lib/debug-service";

export async function GET() {
	await requireAuth();
	return NextResponse.json(getMemoryStats());
}
