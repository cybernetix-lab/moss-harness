export interface TaskFeedback {
  verdict: 'approved' | 'approved_with_suggestions' | 'needs_revision';
  comments: string[];
  suggestions?: string[];
}
