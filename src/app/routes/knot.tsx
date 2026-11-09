import { knots } from "../../engine/knots";
import { KnotScreen } from "../screens/KnotScreen";
import { knotMeta } from "../shared/meta";
import { NotFound } from "./not-found";
import type { Route } from "./+types/knot";

const findKnot = (slug: string | undefined) => knots.find((k) => k.slug === slug);

export const meta: Route.MetaFunction = ({ params }) => {
  const knot = findKnot(params.slug);
  return knot ? knotMeta(knot) : [{ title: "Nudo no encontrado" }];
};

export default function KnotRoute({ params }: Route.ComponentProps) {
  const knot = findKnot(params.slug);
  return knot ? <KnotScreen knot={knot} /> : <NotFound />;
}
