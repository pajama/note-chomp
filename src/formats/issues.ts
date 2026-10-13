import type { ImportIssue } from './types';

export class IssueCollector {
  private readonly warningSet = new Set<string>();
  private readonly errorSet = new Set<string>();

  warn(message: string): void {
    this.warningSet.add(message);
  }

  error(message: string): void {
    this.errorSet.add(message);
  }

  get hasErrors(): boolean {
    return this.errorSet.size > 0;
  }

  get warnings(): ImportIssue[] {
    return [...this.warningSet].map((message) => ({ message }));
  }

  get errors(): ImportIssue[] {
    return [...this.errorSet].map((message) => ({ message }));
  }
}
