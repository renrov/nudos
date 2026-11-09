import { Link } from "react-router";
import { SITE_NAME, knotPath } from "../shared/site";
import { knots } from "../../engine/knots";
import styles from "./not-found.module.css";

export const meta = () => [{ title: `No encontrado · ${SITE_NAME}` }];

export function NotFound() {
  return (
    <main className={styles.page}>
      <h1>Este nudo no está acá</h1>
      <p>
        Mejor probá con el <Link to={knotPath(knots[0])}>{knots[0].name.toLowerCase()}</Link>.
      </p>
    </main>
  );
}

export default NotFound;
