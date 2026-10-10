export type SessionInitializationMode = 'automatic' | 'retry' | 'reload';
type Attempt = {
  templateId: string;
  sessionId: string | null;
  phase: 'loading' | 'ready' | 'failed';
};

/** A new URL and its assigned session URL belong to the same initialization. */
export class SessionInitialization {
  private templateId: string | null = null;
  private requestedId: string | null = null;
  private attempt: Attempt | null = null;

  observe(templateId: string | null, requestedId: string | null) {
    if (this.templateId === templateId && this.requestedId === requestedId) return;
    const assignedUrl = this.templateId === templateId && this.requestedId === null
      && requestedId !== null && this.attempt?.sessionId === requestedId;
    if (!assignedUrl) this.attempt = null;
    this.templateId = templateId;
    this.requestedId = requestedId;
  }

  begin(mode: SessionInitializationMode = 'automatic'): Attempt | null {
    if (!this.templateId || this.attempt?.phase === 'loading') return null;
    if (this.attempt && mode !== 'reload'
        && !(mode === 'retry' && this.attempt.phase === 'failed')) return null;
    this.attempt = {
      templateId: this.templateId,
      // A hydration retry must reopen the project already created, not create another.
      sessionId: this.attempt?.sessionId ?? this.requestedId,
      phase: 'loading',
    };
    return this.attempt;
  }

  isCurrent(attempt: Attempt) { return this.attempt === attempt; }

  resolved(attempt: Attempt, sessionId: number) {
    if (this.isCurrent(attempt)) attempt.sessionId = String(sessionId);
  }

  finish(attempt: Attempt, phase: 'ready' | 'failed') {
    if (this.isCurrent(attempt)) attempt.phase = phase;
  }

  /** Only an explicit new-production action may forget an assigned project. */
  reset() { this.attempt = null; }
}
