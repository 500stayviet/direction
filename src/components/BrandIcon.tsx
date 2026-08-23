/** 현장동선 브랜드 — 2×2 한글 마크 */

interface BrandIconProps {
  size?: number;
  className?: string;
  /** filled: 앱 아이콘 이미지 / mark: 단색 아이콘 */
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon-192.png?v=20260823d"
      width={size}
      height={size}
      alt=""
      className={["rounded-[22%] object-cover", className].join(" ")}
      draggable={false}
    />
  );
}
