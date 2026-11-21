export function getQuestionShareUrl(questionId: string): string {
  if (typeof window === 'undefined') return `/questions/${questionId}`;
  return `${window.location.origin}/questions/${questionId}`;
}

export function getAnswerShareUrl(questionId: string, answerId: string): string {
  if (typeof window === 'undefined') return `/questions/${questionId}#answer-${answerId}`;
  return `${window.location.origin}/questions/${questionId}#answer-${answerId}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback for restricted iframe contexts
    }
  }

  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
