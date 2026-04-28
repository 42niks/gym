import { useEffect, useMemo, useState } from 'react';

export const PROGRESSIVE_LATENCY_THRESHOLD_MS = 700;
const RECENT_SLOW_TTL_MS = 45_000;

let recentSlowUntil = 0;

interface NavigatorConnection {
  saveData?: boolean;
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
}

function getConnection(): NavigatorConnection | null {
  const nav = navigator as Navigator & {
    connection?: NavigatorConnection;
    mozConnection?: NavigatorConnection;
    webkitConnection?: NavigatorConnection;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

export function hasSlowConnectionHint() {
  const connection = getConnection();
  if (!connection) return false;
  if (connection.saveData) return true;
  if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') return true;
  if (typeof connection.rtt === 'number' && connection.rtt >= 450) return true;
  if (typeof connection.downlink === 'number' && connection.downlink > 0 && connection.downlink < 0.75) return true;
  return false;
}

export function rememberSlowNetwork(durationMs = PROGRESSIVE_LATENCY_THRESHOLD_MS) {
  if (durationMs < PROGRESSIVE_LATENCY_THRESHOLD_MS) return;
  recentSlowUntil = Date.now() + RECENT_SLOW_TTL_MS;
}

export function hasRecentSlowNetwork() {
  return Date.now() < recentSlowUntil;
}

export function clearAdaptiveLoadingMemory() {
  recentSlowUntil = 0;
}

export function getInitialProgressiveMode() {
  return hasRecentSlowNetwork() || hasSlowConnectionHint();
}

export function useAdaptiveProgressiveMode(isWaitingForPrimaryRequest: boolean, thresholdMs = PROGRESSIVE_LATENCY_THRESHOLD_MS) {
  const initialProgressive = useMemo(() => getInitialProgressiveMode(), []);
  const [progressive, setProgressive] = useState(initialProgressive);

  useEffect(() => {
    if (progressive || !isWaitingForPrimaryRequest) return;

    const timer = window.setTimeout(() => {
      rememberSlowNetwork(thresholdMs);
      setProgressive(true);
    }, thresholdMs);

    return () => window.clearTimeout(timer);
  }, [isWaitingForPrimaryRequest, progressive, thresholdMs]);

  return {
    initialProgressive,
    progressive,
  };
}
