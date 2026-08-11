"use client";

import { useServerInsertedHTML } from "next/navigation";
import { BOOT_SPLASH_DONE_KEY } from "@/lib/auth";

const BOOT_SPLASH_SCRIPT = `try{if(sessionStorage.getItem(${JSON.stringify(BOOT_SPLASH_DONE_KEY)})!=="1"){var e=document.getElementById("boot-splash");if(e){e.classList.remove("boot-splash-done");e.setAttribute("aria-hidden","false");}}}catch(t){}`;

/**
 * 탭 첫 접속 스플래시 게이트.
 * React 트리에 <script>를 두지 않고 SSR HTML에만 주입해
 * Next 16 / React 19 "Encountered a script tag" 경고를 피함.
 */
export function BootSplashScript() {
  useServerInsertedHTML(() => (
    <script
      id="boot-splash-gate"
      dangerouslySetInnerHTML={{ __html: BOOT_SPLASH_SCRIPT }}
    />
  ));
  return null;
}
