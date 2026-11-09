import type { MetaDescriptor } from "react-router";
import type { KnotDef } from "../../engine/knots/types";
import { SITE_NAME, absoluteUrl, knotImagePath, knotPath } from "./site";

/** Título, descripción, link canónico y vista previa para compartir (Open Graph, Twitter) de la página de un nudo. */
export function knotMeta(knot: KnotDef): MetaDescriptor[] {
  const title = `${knot.name} · ${SITE_NAME}`;
  const url = absoluteUrl(knotPath(knot));
  const image = absoluteUrl(knotImagePath(knot.id));
  return [
    { title },
    { name: "description", content: knot.summary },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: title },
    { property: "og:description", content: knot.summary },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: `Resultado final: ${knot.name}` },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}
