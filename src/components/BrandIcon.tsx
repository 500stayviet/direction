/** 현장동선 브랜드 — 집 + 도로 (내비 앱 스타일) */

interface BrandIconProps {
  size?: number;
  className?: string;
  /** filled: 파란 배경 위 흰 / mark: 단색 아이콘 */
  variant?: "filled" | "mark";
}

export function BrandIcon({
  size = 28,
  className = "",
  variant = "filled",
}: BrandIconProps) {
  if (variant === "mark") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        aria-hidden
      >
        <path
          d="M12 3.5L4.5 10.2V20a1 1 0 0 0 1 1h4.2v-5.2h4.6V21H18.5a1 1 0 0 0 1-1v-9.8L12 3.5z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9.2 14.2h5.6l1.8 5.2H7.4l1.8-5.2z"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M11.3 15.4h1.4v1.2h-1.4zm-.15 2h1.7v1.3h-1.7zm-.2 2.1h2.1v1.4h-2.1z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      aria-hidden
    >
      <rect width="512" height="512" rx="112" fill="#3182F6" />
      <path d="M256 96L150 210h212L256 96z" fill="#fff" />
      <rect x="176" y="200" width="160" height="120" rx="8" fill="#fff" />
      <rect x="228" y="248" width="56" height="72" rx="6" fill="#3182F6" />
      <rect x="286" y="230" width="28" height="28" rx="4" fill="#3182F6" />
      <path d="M214 318 L298 318 L360 452 L152 452 Z" fill="#fff" />
      <path d="M250 340h12v18h-12zM248 372h16v20h-16zM246 406h20v22h-20z" fill="#3182F6" />
    </svg>
  );
}
