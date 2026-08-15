"use client";

export type IntakeMethod = "message" | "talk" | "photo";

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H9l-4 3.2V6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TalkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4.5a7.5 7.5 0 0 1 0 15 8.6 8.6 0 0 1-3.7-.84L5 20l.7-3.2A7.5 7.5 0 0 1 12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 11.5h.01M12 11.5h.01M15 11.5h.01"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="6"
        width="17"
        height="13"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="9" cy="11" r="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 19 12.2 13.5a1.2 1.2 0 0 1 1.9 0L20.5 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ITEMS = [
  {
    id: "message" as const,
    label: "메시지로 입력하기",
    hint: "(내용을 작성 / 붙여넣기)",
    Icon: MessageIcon,
  },
  {
    id: "talk" as const,
    label: "마이크로 입력하기",
    hint: "(마이크로 입력)",
    Icon: TalkIcon,
  },
  {
    id: "photo" as const,
    label: "사진으로 입력하기",
    hint: "(사진에서 추출)",
    Icon: PhotoIcon,
  },
];

export function IntakeSourceBar({
  onSelect,
}: {
  onSelect: (method: IntakeMethod) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-1.5 py-2.5 text-[16px] font-bold leading-tight text-gray-800 shadow-sm active:scale-95 transition-all duration-150"
        >
          <item.Icon className="h-[28px] w-[28px] shrink-0 text-[#3182F6]" />
          <span className="mt-1 text-center">{item.label}</span>
          <span className="mt-0.5 text-center text-[10px] font-medium leading-snug text-gray-400">
            {item.hint}
          </span>
        </button>
      ))}
    </div>
  );
}
