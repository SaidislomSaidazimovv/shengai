import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatScore(value: number): string {
  return Math.round(value).toString();
}

export function scoreColor(value: number): string {
  if (value >= 85) return "text-emerald-600";
  if (value >= 70) return "text-amber-600";
  return "text-rose-600";
}

export function scoreBg(value: number): string {
  if (value >= 85) return "bg-emerald-500";
  if (value >= 70) return "bg-amber-500";
  return "bg-rose-500";
}
