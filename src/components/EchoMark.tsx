export function EchoMark({ active = false, small = false }: { active?: boolean; small?: boolean }) {
  return (
    <div
      className={`echo-mark ${active ? 'is-active' : ''} ${small ? 'is-small' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 220 220" fill="none">
        <ellipse
          className="echo-orbit orbit-one"
          cx="110"
          cy="110"
          rx="87"
          ry="66"
          transform="rotate(-24 110 110)"
        />
        <ellipse
          className="echo-orbit orbit-two"
          cx="110"
          cy="110"
          rx="75"
          ry="84"
          transform="rotate(22 110 110)"
        />
        <ellipse
          className="echo-orbit orbit-three"
          cx="110"
          cy="110"
          rx="59"
          ry="68"
          transform="rotate(-12 110 110)"
        />
        <path
          className="echo-center"
          d="M144 74C165 92 158 123 143 144C128 165 95 164 76 146C56 127 62 98 78 80C96 60 124 56 144 74Z"
        />
        <circle cx="171" cy="66" r="4" className="echo-dot" />
      </svg>
    </div>
  );
}
