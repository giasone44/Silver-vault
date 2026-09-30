/**
 * The last few things that went wrong, with their exact reason, shown under
 * Settings → Recent problems so a single screenshot explains any failure.
 */
export type Problem = { at: string; where: string; message: string; detail: string | null };
const problems: Problem[] = [];

export function recordProblem(where: string, message: string, err?: unknown) {
  let detail: string | null = null;
  if (err instanceof Error) {
    const status = (err as { status?: number }).status;
    detail = [err.name, status ? `HTTP ${status}` : null, err.message].filter(Boolean).join(" · ").slice(0, 600);
  } else if (err != null) {
    detail = String(err).slice(0, 600);
  }
  problems.unshift({ at: new Date().toISOString(), where, message, detail });
  problems.length = Math.min(problems.length, 15);
}

export const recentProblems = () => problems;
