import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { databaseSchema } from './schemas.js';
import type { AssignmentInput, AttemptInput, FeedbackInput, MaterialInput, ProgressSummary, TutorDatabase, WorkInput } from './types.js';

export class StateError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** One authoritative store in the API process. The MCP bridge only uses HTTP. */
export class TutorStore {
  private data: TutorDatabase;
  constructor(private filePath?: string) {
    this.data = filePath && existsSync(filePath)
      ? databaseSchema.parse(JSON.parse(readFileSync(filePath, 'utf8')))
      : { version: 2, records: {} };
  }
  private commit(next: TutorDatabase) {
    if (this.filePath) {
      mkdirSync(dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${randomUUID()}.tmp`;
      writeFileSync(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
      renameSync(temporary, this.filePath);
    }
    this.data = next;
  }
  private mutate<T>(action: (data: TutorDatabase) => T): T {
    const next = structuredClone(this.data);
    const result = action(next);
    this.commit(next);
    return structuredClone(result);
  }
  private record(id: string, data = this.data) {
    const value = data.records[id];
    if (!value) throw new StateError(404, 'Assignment not found. Select an assignment from the workspace.');
    return value;
  }
  listAssignments() { return Object.values(this.data.records).map((record) => structuredClone(record.assignment)).sort((a, b) => b.createdAt - a.createdAt); }
  getContext(id: string) { return structuredClone(this.record(id)); }
  createAssignment(input: AssignmentInput) {
    return this.mutate((data) => {
      const now = Date.now();
      const assignment = { ...input, id: randomUUID(), materials: (input.materials ?? []).map((m) => ({ ...m, id: randomUUID(), createdAt: now })), createdAt: now };
      data.records[assignment.id] = { assignment, draft: null, attempts: [], feedback: [] };
      return assignment;
    });
  }
  addMaterial(id: string, input: MaterialInput) {
    return this.mutate((data) => {
      const record = this.record(id, data);
      if (record.assignment.materials.length >= 10) throw new StateError(409, 'This assignment already has ten materials. Start another assignment for additional sources.');
      const material = { ...input, id: randomUUID(), createdAt: Date.now() };
      record.assignment.materials.push(material);
      return material;
    });
  }
  saveDraft(id: string, input: WorkInput) {
    return this.mutate((data) => {
      const draft = { ...input, updatedAt: Date.now() };
      this.record(id, data).draft = draft;
      return draft;
    });
  }
  recordAttempt(id: string, input: AttemptInput) {
    return this.mutate((data) => {
      const record = this.record(id, data);
      const { clientRequestId, ...work } = input;
      if (clientRequestId) {
        const existing = record.attempts.find((a) => a.id === clientRequestId);
        if (existing) {
          if (existing.work !== work.work || (existing.question ?? '') !== (work.question ?? '') || (existing.errorOutput ?? '') !== (work.errorOutput ?? '')) throw new StateError(409, 'That request ID already belongs to a different attempt.');
          return existing;
        }
      }
      const attempt = { ...work, id: clientRequestId ?? randomUUID(), assignmentId: id, createdAt: Date.now() };
      record.attempts.push(attempt);
      return attempt;
    });
  }
  recordFeedback(id: string, input: FeedbackInput) {
    return this.mutate((data) => {
      const record = this.record(id, data);
      if (!record.attempts.some((a) => a.id === input.attemptId)) throw new StateError(404, 'Record the student attempt in this assignment before attaching feedback.');
      const previous = record.feedback.findIndex((f) => f.attemptId === input.attemptId);
      if (previous >= 0) {
        const { id: _id, assignmentId: _assignmentId, author: _author, updatedAt: _updatedAt, ...saved } = record.feedback[previous];
        if (JSON.stringify(saved) === JSON.stringify(input)) return record.feedback[previous];
      }
      const feedback = { ...input, id: previous < 0 ? randomUUID() : record.feedback[previous].id, assignmentId: id, author: 'go-agent' as const, updatedAt: Date.now() };
      if (previous < 0) record.feedback.push(feedback); else record.feedback[previous] = feedback;
      return feedback;
    });
  }
  getProgress(id: string): ProgressSummary {
    const { attempts, feedback } = this.record(id);
    const concepts = new Map<string, { concept: string; mentions: number; lastSeenAt: number }>();
    for (const item of feedback) for (const concept of new Set(item.missedConcepts)) {
      const previous = concepts.get(concept);
      concepts.set(concept, { concept, mentions: (previous?.mentions ?? 0) + 1, lastSeenAt: Math.max(previous?.lastSeenAt ?? 0, item.updatedAt) });
    }
    return {
      assignmentId: id, attemptsTotal: attempts.length, reviewedAttempts: feedback.length,
      demonstratedAttempts: feedback.filter((f) => f.assessment === 'demonstrated').length,
      practiceTopics: [...concepts.values()].sort((a, b) => b.mentions - a.mentions),
      latestNextStep: [...feedback].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.nextStep ?? null,
    };
  }
}
