import { getImageUrl, FALLBACK_IMAGE } from "@gi-tcg/roguelike";
import type { JSX } from "solid-js";

export interface SafeImageProps {
  entityId: number;
  alt?: string;
  class?: string;
  loading?: "lazy" | "eager";
  style?: JSX.CSSProperties;
}

/** 图片组件：自动使用 getImageUrl 作为 src，加载失败时回退到 FALLBACK_IMAGE */
export function SafeImage(props: SafeImageProps) {
  return (
    <img
      src={getImageUrl(props.entityId)}
      alt={props.alt}
      class={props.class}
      loading={props.loading}
      style={props.style}
      onDragStart={(e) => e.preventDefault()}
      onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)}
    />
  );
}
