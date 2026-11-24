export function getQuestionShareUrl(questionId: string): string {
  if (typeof window === 'undefined') return `/questions/${questionId}`;
  return `${window.location.origin}/questions/${questionId}`;
}

export function getAnswerShareUrl(questionId: string, answerId: string): string {
  if (typeof window === 'undefined') return `/questions/${questionId}#answer-${answerId}`;
  return `${window.location.origin}/questions/${questionId}#answer-${answerId}`;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export function buildShareSnippet(text?: string | null, maxLength = 140): string | undefined {
  if (!text) return undefined;
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';
  if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return true;
  }

  const hasTouch = navigator.maxTouchPoints > 0;
  const isNarrowViewport =
    typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023px)').matches;
  const hasCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  return hasTouch && (isNarrowViewport || hasCoarsePointer);
}

export function canUseNativeShare(data?: ShareData): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  if (data && typeof navigator.canShare === 'function') {
    try {
      return navigator.canShare(data);
    } catch {
      return false;
    }
  }
  return true;
}

export async function shareContent({
  title,
  text,
  url,
}: {
  title?: string;
  text?: string;
  url: string;
}): Promise<ShareOutcome> {
  const snippet = buildShareSnippet(text);
  const fullData: ShareData = {
    url,
    ...(title?.trim() ? { title: title.trim() } : {}),
    ...(snippet ? { text: snippet } : {}),
  };

  const urlOnlyData: ShareData = {
    url,
    ...(title?.trim() ? { title: title.trim() } : {}),
  };

  const sharePayload = canUseNativeShare(fullData)
    ? fullData
    : canUseNativeShare(urlOnlyData)
    ? urlOnlyData
    : null;

  if (sharePayload && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(sharePayload);
      return 'shared';
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === 'AbortError' ||
          (typeof DOMException !== 'undefined' &&
            err instanceof DOMException &&
            err.name === 'AbortError'))
      ) {
        return 'cancelled';
      }
      // Fall through to clipboard copy if Web Share API is blocked (e.g., restricted iframe)
    }
  }

  const copied = await copyTextToClipboard(url);
  return copied ? 'copied' : 'failed';
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
