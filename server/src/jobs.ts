import { randomUUID } from "node:crypto";
import { recordProblem } from "./diagnostics.js";

/**
 * Long AI tasks (identifying with web search can take a couple of minutes) run
 * here in the background. The phone starts one, then checks back every few
 * seconds, so no single request is held open long enough for Safari to drop it.
 */
type Job = { status: "running" | "done" | "failed"; result?: unknown; error?: string; started: number };
const jobs = new Map<string, Job>();

export function startJob(where: string, task: () => Promise<unknown>, describe: (err: unknown) => string): string {
  const id = randomUUID();
  const job: Job = { status: "running", started: Date.now() };
  jobs.set(id, job);
  task().then(
    (result) => Object.assign(job, { status: "done", result }),
    (err) => {
      console.error(`${where} failed:`, err);
      const error = describe(err);
      recordProblem(where, error, err);
      Object.assign(job, { status: "failed", error });
    },
  );
  // Forget finished jobs after an hour.
  for (const [k, j] of jobs) if (Date.now() - j.started > 3600_000) jobs.delete(k);
  return id;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
