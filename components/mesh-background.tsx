"use client";

import { useEffect, useRef } from "react";

interface Point {
	x: number; // base position (drifts naturally)
	y: number;
	vx: number;
	vy: number;
	ox: number; // mouse displacement offset
	oy: number;
	hue: number;
	opacity: number;
	targetOpacity: number;
}

const DENSITY = 12000;
const MAX_POINTS = 100;
const FADE_SPEED = 0.03;
const MOUSE_RADIUS = 300;
const MOUSE_STRENGTH = 20;
const SPRING_BACK = 0.03;

export function MeshBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animId: number;
		const points: Point[] = [];
		let lastW = 0;
		let lastH = 0;
		let mouseX = -1000;
		let mouseY = -1000;

		function onMouseMove(e: MouseEvent) {
			mouseX = e.clientX;
			mouseY = e.clientY;
		}

		function targetCount(): number {
			if (!canvas) return 0;
			return Math.min(
				Math.max(
					Math.floor((canvas.offsetWidth * canvas.offsetHeight) / DENSITY),
					8,
				),
				MAX_POINTS,
			);
		}

		function resize() {
			if (!canvas || !ctx) return;
			const dpr = window.devicePixelRatio;
			const w = canvas.offsetWidth;
			const h = canvas.offsetHeight;
			canvas.width = w * dpr;
			canvas.height = h * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

			// Scale existing point positions proportionally to new size
			if (lastW > 0 && lastH > 0 && (w !== lastW || h !== lastH)) {
				const sx = w / lastW;
				const sy = h / lastH;
				for (const p of points) {
					p.x *= sx;
					p.y *= sy;
				}
			}

			const target = targetCount();
			const active = points.filter((p) => p.targetOpacity > 0).length;

			// Add more if needed — spread across full canvas
			for (let i = 0; i < target - active; i++) {
				points.push({
					x: Math.random() * w,
					y: Math.random() * h,
					vx: (Math.random() - 0.5) * 0.4,
					vy: (Math.random() - 0.5) * 0.4,
					ox: 0,
					oy: 0,
					hue: Math.random() * 360,
					opacity: 0,
					targetOpacity: 1,
				});
			}

			// Fade out excess
			let excess = active - target;
			for (let i = points.length - 1; i >= 0 && excess > 0; i--) {
				if (points[i].targetOpacity > 0) {
					points[i].targetOpacity = 0;
					excess--;
				}
			}

			lastW = w;
			lastH = h;
		}

		function draw() {
			if (!canvas || !ctx) return;
			const w = canvas.offsetWidth;
			const h = canvas.offsetHeight;

			ctx.clearRect(0, 0, w, h);

			// Update
			for (let i = points.length - 1; i >= 0; i--) {
				const p = points[i];

				// Fade
				if (p.opacity < p.targetOpacity) {
					p.opacity = Math.min(p.opacity + FADE_SPEED, 1);
				} else if (p.opacity > p.targetOpacity) {
					p.opacity -= FADE_SPEED;
					if (p.opacity <= 0) {
						points.splice(i, 1);
						continue;
					}
				}

				// Move
				p.x += p.vx;
				p.y += p.vy;
				p.hue = (p.hue + 0.1) % 360;

				// Bounce
				if (p.x <= 0) {
					p.x = 0;
					p.vx = Math.abs(p.vx);
				}
				if (p.x >= w) {
					p.x = w;
					p.vx = -Math.abs(p.vx);
				}
				if (p.y <= 0) {
					p.y = 0;
					p.vy = Math.abs(p.vy);
				}
				if (p.y >= h) {
					p.y = h;
					p.vy = -Math.abs(p.vy);
				}

				// Mouse repulsion — nudge offset, spring back
				const dx = p.x - mouseX;
				const dy = p.y - mouseY;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < MOUSE_RADIUS && dist > 0) {
					const force = (1 - dist / MOUSE_RADIUS) * MOUSE_STRENGTH;
					p.ox += (dx / dist) * force * 0.1;
					p.oy += (dy / dist) * force * 0.1;
				}
				// Spring back toward base position
				p.ox *= 1 - SPRING_BACK;
				p.oy *= 1 - SPRING_BACK;
			}

			// Lines
			const maxDist = 200;
			for (let i = 0; i < points.length; i++) {
				for (let j = i + 1; j < points.length; j++) {
					const a = points[i];
					const b = points[j];
					const ax = a.x + a.ox;
					const ay = a.y + a.oy;
					const bx = b.x + b.ox;
					const by = b.y + b.oy;
					const dx = ax - bx;
					const dy = ay - by;
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < maxDist) {
						const alpha =
							(1 - dist / maxDist) * 0.12 * Math.min(a.opacity, b.opacity);
						if (alpha < 0.001) continue;
						ctx.beginPath();
						ctx.moveTo(ax, ay);
						ctx.lineTo(bx, by);
						ctx.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 60%, 60%, ${alpha})`;
						ctx.lineWidth = 1;
						ctx.stroke();
					}
				}
			}

			// Blobs
			for (const p of points) {
				if (p.opacity < 0.01) continue;
				const px = p.x + p.ox;
				const py = p.y + p.oy;
				const g = ctx.createRadialGradient(px, py, 0, px, py, 80);
				g.addColorStop(0, `hsla(${p.hue}, 70%, 60%, ${0.06 * p.opacity})`);
				g.addColorStop(1, "hsla(0,0%,0%,0)");
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(px, py, 80, 0, Math.PI * 2);
				ctx.fill();
			}

			animId = requestAnimationFrame(draw);
		}

		resize();
		draw();
		window.addEventListener("resize", resize);
		window.addEventListener("mousemove", onMouseMove);

		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener("resize", resize);
			window.removeEventListener("mousemove", onMouseMove);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="fixed inset-0 -z-10 w-full h-full"
			style={{ pointerEvents: "none" }}
		/>
	);
}
