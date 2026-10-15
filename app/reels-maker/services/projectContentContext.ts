import type { Locale } from '@/app/i18n/config';
/** UI language changes never change the content language of an in-flight production. */
export class ProjectContentContext {
  private observedId: string | null = null;
  private request: { templateId: string | null; sessionId: string | null; locale: Locale } | null = null;
  observe(templateId: string | null, requestedId: string | null, assignedId: number | null, locale: Locale) {
    const assignedUrl = this.request?.templateId === templateId && this.observedId === null && requestedId !== null && requestedId === String(assignedId);
    if (!this.request || this.request.templateId !== templateId || (this.observedId !== requestedId && !assignedUrl)) {
      this.request = { templateId, sessionId: requestedId, locale };
    }
    this.observedId = requestedId;
    return this.request;
  }
}
