const PALETTE = [
  "#7AA079", // sage
  "#C9A66B", // amber
  "#6E8FA8", // info blue
  "#C2685A", // terracotta
  "#9D7AA0", // mauve
  "#7AA0A0", // teal
];

export function brandColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
