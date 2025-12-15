import type { ProjectState } from "@/lib/types";

function parseDateUtc(date: string) {
  const [year, month, day] = date.split("-").map((v) => Number(v));
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
}

export function timeRemainingLabel(state: ProjectState, deadline: string) {
  if (state === "completed") return "CLOSED";
  if (state === "failed") return "ENDED";
  if (state === "draft") return "PENDING";

  const now = new Date();
  const end = parseDateUtc(deadline);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return "00D : 00H";

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  const dayStr = String(days).padStart(2, "0");
  const hourStr = String(hours).padStart(2, "0");
  return `${dayStr}D : ${hourStr}H`;
}

