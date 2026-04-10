import type { TimelineEvent } from "../model/run.js";
import { MosscliFileStore } from "../store/file-store.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStageScopedEvent(type: string): boolean {
  return type.startsWith("stage_");
}

export function isReplaySafeEvent(event: unknown): event is TimelineEvent {
  if (!isObject(event)) {
    return false;
  }

  if (typeof event.type !== "string" || typeof event.timestamp !== "string" || typeof event.run_id !== "string") {
    return false;
  }

  if (typeof event.source !== "string") {
    return false;
  }

  if (!isObject(event.data)) {
    return false;
  }

  if (isStageScopedEvent(event.type) && typeof event.stage !== "string") {
    return false;
  }

  return true;
}

export class TelemetryAdapter {
  private readonly store = new MosscliFileStore();

  readReplaySafeTimeline(runId: string): TimelineEvent[] {
    return this.store.readTimeline(runId).filter((event) => isReplaySafeEvent(event));
  }
}
