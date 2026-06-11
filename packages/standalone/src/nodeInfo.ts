import type { NodeType } from "@gi-tcg/roguelike";

export const NODE_INFO: Record<NodeType, { icon: string; name: string }> = {
  normal: { icon: "⚔️", name: "普通" },
  elite: { icon: "💀", name: "精英" },
  shop: { icon: "🏪", name: "商店" },
  boss: { icon: "👑", name: "Boss" },
  event: { icon: "📜", name: "事件" },
};
