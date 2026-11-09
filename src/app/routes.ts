import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route(":slug", "routes/knot.tsx"),
  route("estrellas", "routes/stargazers.tsx"),
  route("grabador", "routes/recorder.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
