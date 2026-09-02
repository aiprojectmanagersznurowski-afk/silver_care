'use client'

import { useEffect, useState } from 'react'

interface ActivityRingsProps {
  stepsProgress: number;
  activityProgress: number;
  sleepProgress: number;
}

export function ActivityRings({ stepsProgress, activityProgress, sleepProgress }: ActivityRingsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const r1 = 80, r2 = 62, r3 = 44;
  const sw = 13;
  const c1 = 2 * Math.PI * r1;
  const c2 = 2 * Math.PI * r2;
  const c3 = 2 * Math.PI * r3;

  const transition = "stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <svg viewBox="0 0 200 200" className="w-48 h-48 sm:w-56 sm:h-56">
      {/* Tracks */}
      <circle cx="100" cy="100" r={r1} fill="none" stroke="#FF6B47" strokeWidth={sw} strokeOpacity="0.12" />
      <circle cx="100" cy="100" r={r2} fill="none" stroke="#30D158" strokeWidth={sw} strokeOpacity="0.12" />
      <circle cx="100" cy="100" r={r3} fill="none" stroke="#AF52DE" strokeWidth={sw} strokeOpacity="0.12" />

      {/* Progress arcs */}
      <circle
        cx="100" cy="100" r={r1}
        fill="none"
        stroke="#FF6B47"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={c1}
        strokeDashoffset={mounted ? c1 * Math.max(0, 1 - stepsProgress) : c1}
        transform="rotate(-90 100 100)"
        style={{ transition }}
      />
      <circle
        cx="100" cy="100" r={r2}
        fill="none"
        stroke="#30D158"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={c2}
        strokeDashoffset={mounted ? c2 * Math.max(0, 1 - activityProgress) : c2}
        transform="rotate(-90 100 100)"
        style={{ transition: `${transition} 0.15s` }}
      />
      <circle
        cx="100" cy="100" r={r3}
        fill="none"
        stroke="#AF52DE"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={c3}
        strokeDashoffset={mounted ? c3 * Math.max(0, 1 - sleepProgress) : c3}
        transform="rotate(-90 100 100)"
        style={{ transition: `${transition} 0.3s` }}
      />
    </svg>
  );
}
