import { useNavigate } from "react-router";
import { knots } from "../../engine/knots";
import { KnotScreen } from "../screens/KnotScreen";
import { useMountEffect } from "../shared/hooks";
import { knotMeta } from "../shared/meta";
import { knotPath } from "../shared/site";

// La home muestra el primer nudo; su link canónico apunta a la página propia de ese nudo.
export const meta = () => knotMeta(knots[0]);

export default function Home() {
  const navigate = useNavigate();
  // Los links de antes de que los nudos tuvieran página propia usaban ?knot=<id>; mandarlos a esa página.
  useMountEffect(() => {
    const params = new URLSearchParams(location.search);
    const knot = knots.find((k) => k.id === params.get("knot"));
    if (!knot) return;
    params.delete("knot");
    const rest = params.toString().replace("tune=", "tune");
    navigate(`${knotPath(knot)}${rest ? `?${rest}` : ""}`, { replace: true });
  });
  return <KnotScreen knot={knots[0]} />;
}
