import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export type PullToRefreshStatus =
  | 'idle'
  | 'pulling'
  | 'ready'
  | 'refreshing'
  | 'offline'
  | 'refreshed';

const START_SLOP_PX = 10;
const PULL_THRESHOLD_PX = 68;
const MAX_PULL_PX = 112;
const ACTIVE_REFRESH_HEIGHT_PX = 52;
const PULL_DAMPING = 0.48;

function isInteractiveInput(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('input, textarea, select, option, [contenteditable="true"]')
  );
}

function isInteractiveControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, option, button, a, [role="button"], [contenteditable="true"]'
    )
  );
}

export function usePullToRefresh({
  scrollRef,
  onRefresh,
  isOnline,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  onRefresh?: () => Promise<unknown>;
  isOnline: boolean;
}) {
  const enabled = typeof onRefresh === 'function';

  const [pullDistance, setPullDistance] = useState(0);
  const [status, setStatus] = useState<PullToRefreshStatus>('idle');
  const [justReconnected, setJustReconnected] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  const isOnlineRef = useRef(isOnline);
  const pullDistanceRef = useRef(0);
  const statusRef = useRef<PullToRefreshStatus>('idle');
  const wasOfflineRef = useRef(!isOnline);
  const resetTimerRef = useRef<number | null>(null);

  // Active gesture tracking refs
  const touchTrackingRef = useRef(false);
  const touchEngagedRef = useRef(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const pointerIdRef = useRef<number | null>(null);
  const pointerEngagedRef = useRef(false);
  const pointerStartXRef = useRef(0);
  const pointerStartYRef = useRef(0);

  onRefreshRef.current = onRefresh;
  isOnlineRef.current = isOnline;

  const setPullState = useCallback(
    (distance: number, nextStatus: PullToRefreshStatus) => {
      pullDistanceRef.current = distance;
      statusRef.current = nextStatus;
      setPullDistance(distance);
      setStatus(nextStatus);
    },
    []
  );

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  // Track offline -> online transitions when page supports pull-to-refresh
  useEffect(() => {
    if (!enabled) {
      wasOfflineRef.current = !isOnline;
      setJustReconnected(false);
      return;
    }

    if (!isOnline) {
      wasOfflineRef.current = true;
      setJustReconnected(false);
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setJustReconnected(true);
    }
  }, [enabled, isOnline]);

  useEffect(() => {
    return () => clearResetTimer();
  }, [clearResetTimer]);

  const dismissReconnected = useCallback(() => {
    setJustReconnected(false);
  }, []);

  const triggerRefresh = useCallback(async () => {
    const refreshFn = onRefreshRef.current;
    if (!refreshFn || statusRef.current === 'refreshing') return;

    clearResetTimer();

    const onlineNow =
      isOnlineRef.current &&
      (typeof navigator === 'undefined' || navigator.onLine);

    if (!onlineNow) {
      setPullState(48, 'offline');
      resetTimerRef.current = window.setTimeout(() => {
        setPullState(0, 'idle');
      }, 1700);
      return;
    }

    setPullState(ACTIVE_REFRESH_HEIGHT_PX, 'refreshing');
    const startedAt = Date.now();

    try {
      await refreshFn();
      setJustReconnected(false);
    } catch {
      // Query states surface fetch errors inline; settle indicator cleanly
    } finally {
      const elapsed = Date.now() - startedAt;
      const remainingSpin = Math.max(0, 350 - elapsed);
      resetTimerRef.current = window.setTimeout(() => {
        setPullState(44, 'refreshed');
        resetTimerRef.current = window.setTimeout(() => {
          setPullState(0, 'idle');
        }, 700);
      }, remainingSpin);
    }
  }, [clearResetTimer, setPullState]);

  useEffect(() => {
    if (!enabled) {
      setPullState(0, 'idle');
      return;
    }

    const el = scrollRef.current;
    if (!el) return;

    const isAtScrollTop = () => {
      const elTop = el.scrollTop <= 1;
      const winTop = window.scrollY <= 1;
      return elTop && winTop;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (
        statusRef.current === 'refreshing' ||
        e.touches.length !== 1 ||
        !isAtScrollTop() ||
        isInteractiveInput(e.target)
      ) {
        touchTrackingRef.current = false;
        return;
      }

      clearResetTimer();
      touchTrackingRef.current = true;
      touchEngagedRef.current = false;
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchTrackingRef.current || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dy = touch.clientY - touchStartYRef.current;
      const dx = touch.clientX - touchStartXRef.current;

      if (!touchEngagedRef.current) {
        if (!isAtScrollTop() || dy <= 0 || Math.abs(dx) > dy) {
          touchTrackingRef.current = false;
          if (pullDistanceRef.current > 0) {
            setPullState(0, 'idle');
          }
          return;
        }
        if (dy > START_SLOP_PX) {
          touchEngagedRef.current = true;
        } else {
          return;
        }
      }

      if (e.cancelable) {
        e.preventDefault();
      }
      const damped = Math.min(MAX_PULL_PX, Math.max(0, (dy - START_SLOP_PX) * PULL_DAMPING));
      setPullState(
        damped,
        damped >= PULL_THRESHOLD_PX ? 'ready' : 'pulling'
      );
    };

    const finishTouch = () => {
      if (!touchTrackingRef.current) return;
      const wasEngaged = touchEngagedRef.current;
      const distance = pullDistanceRef.current;
      touchTrackingRef.current = false;
      touchEngagedRef.current = false;

      if (wasEngaged && distance >= PULL_THRESHOLD_PX) {
        void triggerRefresh();
      } else if (wasEngaged || distance > 0) {
        setPullState(0, 'idle');
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (
        e.pointerType === 'touch' ||
        e.button !== 0 ||
        statusRef.current === 'refreshing' ||
        !isAtScrollTop() ||
        isInteractiveControl(e.target)
      ) {
        return;
      }

      clearResetTimer();
      pointerIdRef.current = e.pointerId;
      pointerEngagedRef.current = false;
      pointerStartXRef.current = e.clientX;
      pointerStartYRef.current = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (pointerIdRef.current !== e.pointerId) return;

      const dy = e.clientY - pointerStartYRef.current;
      const dx = e.clientX - pointerStartXRef.current;

      if (!pointerEngagedRef.current) {
        if (!isAtScrollTop() || dy <= 0 || Math.abs(dx) * 1.35 > dy) {
          pointerIdRef.current = null;
          return;
        }
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          pointerIdRef.current = null;
          return;
        }
        if (dy > START_SLOP_PX * 1.5) {
          pointerEngagedRef.current = true;
          selection?.removeAllRanges();
        } else {
          return;
        }
      }

      const damped = Math.min(
        MAX_PULL_PX,
        Math.max(0, (dy - START_SLOP_PX * 1.5) * PULL_DAMPING)
      );
      setPullState(
        damped,
        damped >= PULL_THRESHOLD_PX ? 'ready' : 'pulling'
      );
    };

    const finishPointer = (e: PointerEvent) => {
      if (pointerIdRef.current !== e.pointerId) return;
      const wasEngaged = pointerEngagedRef.current;
      const distance = pullDistanceRef.current;
      pointerIdRef.current = null;
      pointerEngagedRef.current = false;

      if (wasEngaged && distance >= PULL_THRESHOLD_PX) {
        void triggerRefresh();
      } else if (wasEngaged || distance > 0) {
        setPullState(0, 'idle');
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', finishTouch, { passive: true });
    el.addEventListener('touchcancel', finishTouch, { passive: true });

    el.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishPointer);
    window.addEventListener('pointercancel', finishPointer);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', finishTouch);
      el.removeEventListener('touchcancel', finishTouch);

      el.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishPointer);
      window.removeEventListener('pointercancel', finishPointer);
    };
  }, [clearResetTimer, enabled, scrollRef, setPullState, triggerRefresh]);

  return {
    pullDistance,
    status,
    progress: Math.min(1, pullDistance / PULL_THRESHOLD_PX),
    justReconnected,
    dismissReconnected,
    triggerRefresh,
  };
}
