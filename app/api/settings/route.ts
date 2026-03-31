import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import {
	getAllSettings,
	isAllowedSetting,
	updateSettings,
} from "@/lib/settings-service";

export async function GET(): Promise<Response> {
	try {
		await requireAuth();
	} catch (res) {
		return res as Response;
	}
	return NextResponse.json(await getAllSettings());
}

export async function PUT(request: NextRequest): Promise<Response> {
	try {
		await requireAuth();
	} catch (res) {
		return res as Response;
	}
	const body = (await request.json()) as Record<string, string>;

	// Validate all keys against allowlist
	for (const key of Object.keys(body)) {
		if (!isAllowedSetting(key)) {
			return NextResponse.json(
				{ error: `Invalid setting: ${key}` },
				{ status: 400 },
			);
		}
	}

	await updateSettings(body);
	return NextResponse.json({ success: true });
}
