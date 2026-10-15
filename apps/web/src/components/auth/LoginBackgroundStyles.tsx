'use client'

import React from 'react'

export function LoginBackgroundStyles() {
  return (
    <style>{`
      .accent-lines {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.4;
      }
      .hline, .vline {
        position: absolute;
        background: var(--color-border);
        will-change: transform, opacity;
      }
      .hline {
        left: 0;
        right: 0;
        height: 1px;
        transform: scaleX(0);
        transform-origin: 50% 50%;
        animation: drawX .8s cubic-bezier(.22,.61,.36,1) forwards;
      }
      .vline {
        top: 0;
        bottom: 0;
        width: 1px;
        transform: scaleY(0);
        transform-origin: 50% 0%;
        animation: drawY .9s cubic-bezier(.22,.61,.36,1) forwards;
      }
      .hline:nth-child(1) { top: 18%; animation-delay: .12s; }
      .hline:nth-child(2) { top: 50%; animation-delay: .22s; }
      .hline:nth-child(3) { top: 82%; animation-delay: .32s; }
      .vline:nth-child(4) { left: 22%; animation-delay: .42s; }
      .vline:nth-child(5) { left: 50%; animation-delay: .54s; }
      .vline:nth-child(6) { left: 78%; animation-delay: .66s; }
      .vline:nth-child(4)::after { animation-delay: .42s; }
      .vline:nth-child(5)::after { animation-delay: .54s; }
      .vline:nth-child(6)::after { animation-delay: .66s; }

      @keyframes drawX {
        0% { transform: scaleX(0); opacity: 0; }
        60% { opacity: .95; }
        100% { transform: scaleX(1); opacity: .7; }
      }
      @keyframes drawY {
        0% { transform: scaleY(0); opacity: 0; }
        60% { opacity: .95; }
        100% { transform: scaleY(1); opacity: .7; }
      }
      @keyframes shimmer {
        0% { opacity: 0; }
        35% { opacity: .25; }
        100% { opacity: 0; }
      }

      .card-animate {
        opacity: 0;
        transform: translateY(16px);
        animation: fadeUp 0.7s cubic-bezier(.22,.61,.36,1) 0.2s forwards;
      }
      @keyframes fadeUp {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `}</style>
  )
}
