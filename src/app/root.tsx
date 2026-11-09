import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";
import { SITE_DESCRIPTION, SITE_NAME } from "./shared/site";
import alegreya from "./styles/fonts/alegreya-latin-wght-normal.woff2?url";
import archivo from "./styles/fonts/archivo-latin-wght-normal.woff2?url";
import "./styles/global.css";
import type { Route } from "./+types/root";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#e8eaee" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Las fuentes se piden junto con la página, no recién cuando el CSS las encuentra.
export const links = () => [
  { rel: "preload", as: "font", type: "font/woff2", href: archivo, crossOrigin: "anonymous" },
  { rel: "preload", as: "font", type: "font/woff2", href: alegreya, crossOrigin: "anonymous" },
];

export const meta = () => [
  { title: SITE_NAME },
  { name: "description", content: SITE_DESCRIPTION },
];

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "Algo salió mal";
  return (
    <main
      style={{ display: "grid", placeContent: "center", height: "100dvh", textAlign: "center" }}
    >
      <h1>{message}</h1>
      <p>
        <a href="/">Volver a los nudos</a>
      </p>
    </main>
  );
}
