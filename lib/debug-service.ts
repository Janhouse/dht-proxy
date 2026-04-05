import { heapStats } from "bun:jsc";

export interface MemoryStats {
	rss: number;
	heapUsed: number;
	heapTotal: number;
	external: number;
	arrayBuffers: number;
	jsc: {
		heapSize: number;
		heapCapacity: number;
		extraMemorySize: number;
		objectCount: number;
		protectedObjectCount: number;
		globalObjectCount: number;
		objectTypeCounts: Record<string, number>;
		protectedObjectTypeCounts: Record<string, number>;
	};
}

export function getMemoryStats(): MemoryStats {
	const heap = heapStats();
	const mem = process.memoryUsage();

	return {
		rss: mem.rss,
		heapUsed: mem.heapUsed,
		heapTotal: mem.heapTotal,
		external: mem.external,
		arrayBuffers: mem.arrayBuffers,
		jsc: {
			heapSize: heap.heapSize,
			heapCapacity: heap.heapCapacity,
			extraMemorySize: heap.extraMemorySize,
			objectCount: heap.objectCount,
			protectedObjectCount: heap.protectedObjectCount,
			globalObjectCount: heap.globalObjectCount,
			objectTypeCounts: heap.objectTypeCounts,
			protectedObjectTypeCounts: heap.protectedObjectTypeCounts,
		},
	};
}
