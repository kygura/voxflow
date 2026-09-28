// DESIGN.md §7 — monochrome icons. stroke = currentColor, 1.5px, square caps/joins
// (no rounded strokes anywhere in the brutalist brief).
// Size per DESIGN: 14px in pill / badge, 16px in icon buttons (pass `size`).

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "square" as const,
    strokeLinejoin: "miter" as const,
    "aria-hidden": true,
  };
}

export function Trash({ size = 16 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function Copy({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function Check({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M5 12l5 5L19 7" />
    </svg>
  );
}

export function CheckCircle({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

export function Clipboard({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

export function AlertCircle({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

export function X({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function Search({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function Play({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  );
}

export function File({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M6 2h9l5 5v15H6V2z" />
      <path d="M15 2v5h5" />
    </svg>
  );
}

export function Eye({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
