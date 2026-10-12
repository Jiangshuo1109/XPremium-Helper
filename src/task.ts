import type { RelationshipAction } from "./model";

export interface ExternalActionTask {
  id: string;
  viewer: string;
  target: string;
  action: RelationshipAction;
  sourceTab: number | null;
  createdAt: number;
  expiresAt: number;
}

const KEY = "xfhExternalAction";
const FALLBACK_KEY = "xfhExternalActionFallback";
const TTL = 30_000;

function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function createExternalTask(
  viewer: string,
  target: string,
  action: RelationshipAction,
  sourceTab: number | null = null,
): Promise<ExternalActionTask> {
  const now = Date.now();
  const task: ExternalActionTask = {
    id: randomId(), viewer, target, action, sourceTab,
    createdAt: now, expiresAt: now + TTL,
  };
  try {
    await chrome.storage.session.set({ [KEY]: task });
  } catch {
    await chrome.storage.local.set({ [FALLBACK_KEY]: task });
  }
  return task;
}

export async function readExternalTask(): Promise<ExternalActionTask | null> {
  let task: ExternalActionTask | undefined;
  try {
    const data = await chrome.storage.session.get(KEY);
    task = data[KEY] as ExternalActionTask | undefined;
  } catch {
    const data = await chrome.storage.local.get(FALLBACK_KEY);
    task = data[FALLBACK_KEY] as ExternalActionTask | undefined;
  }
  if (!task || task.expiresAt <= Date.now()) {
    if (task) {
      await chrome.storage.session.remove(KEY).catch(() => {});
      await chrome.storage.local.remove(FALLBACK_KEY).catch(() => {});
    }
    return null;
  }
  return task;
}

export async function clearExternalTask(id: string): Promise<void> {
  const task = await readExternalTask();
  if (task?.id === id) {
    await chrome.storage.session.remove(KEY).catch(() => {});
    await chrome.storage.local.remove(FALLBACK_KEY).catch(() => {});
  }
}

export const externalTaskKey = KEY;
