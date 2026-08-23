/** 로고·스플래시 캐시 무효화 (파일명은 같고 쿼리만 바꿈) */
export const BRAND_ASSET_V = "20260823d";

export function brandAsset(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}v=${BRAND_ASSET_V}`;
}
