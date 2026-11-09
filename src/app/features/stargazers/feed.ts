import type { Star } from "./rope";

/**
 * El feed de stargazers que escribe `tools/stargazers.mjs`: la hora de la primera estrella
 * (segundos epoch), después, por cada estrella, [login, id de usuario de GitHub, segundos desde la
 * estrella anterior].
 */
export type Feed = { v: 1; t0: number; s: [login: string, id: number, dt: number][] };

/** El feed → estrellas con la forma de la API de stargazers de GitHub, de la más vieja a la más nueva. */
export function decodeFeed(feed: Feed): Star[] {
  let t = feed.t0;
  return feed.s.map(([login, id, dt]) => ({
    starred_at: new Date((t += dt) * 1000).toISOString(),
    user: {
      login,
      id,
      avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`,
      html_url: `https://github.com/${login}`,
    },
  }));
}
