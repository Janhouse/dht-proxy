"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteTorrentButton({
	torrentId,
	torrentName,
	redirectTo,
}: {
	torrentId: string;
	torrentName: string;
	redirectTo?: string;
}) {
	const router = useRouter();
	const [deleting, setDeleting] = useState(false);

	async function handleDelete() {
		setDeleting(true);
		const res = await fetch(`/api/torrents/${torrentId}`, {
			method: "DELETE",
		});
		if (res.ok) {
			if (redirectTo) {
				router.push(redirectTo);
			} else {
				router.refresh();
			}
		}
		setDeleting(false);
	}

	return (
		<AlertDialog>
			<AlertDialogTrigger
				render={
					<Button variant="destructive" size="sm" disabled={deleting}>
						{deleting ? "..." : "Delete"}
					</Button>
				}
			/>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete torrent?</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete &quot;{torrentName}&quot; and all its
						discovered peers. This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
