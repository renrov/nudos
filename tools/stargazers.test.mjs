import { describe, expect, it } from "vitest";
import { decodeFeed } from "../src/app/features/stargazers/feed";
import { decode, encode, merge } from "./stargazers.mjs";

const star = (login, id, iso) => ({ login, id, time: Date.parse(iso) });

describe("feed de stargazers", () => {
  it("va y vuelve a través del decodificador de la página", () => {
    const stars = [star("b", 2, "2026-10-02T08:00:00Z"), star("a", 1, "2026-10-01T09:30:00Z")];
    const feed = JSON.parse(encode(stars));
    expect(decode(feed)).toEqual([stars[1], stars[0]]);
    expect(decodeFeed(feed).map((s) => [s.user.login, s.starred_at])).toEqual([
      ["a", "2026-10-01T09:30:00.000Z"],
      ["b", "2026-10-02T08:00:00.000Z"],
    ]);
    expect(decodeFeed(feed)[0].user.avatar_url).toBe(
      "https://avatars.githubusercontent.com/u/1?v=4",
    );
  });

  it("conserva los nudos una vez atados, en su primera estrella, con el login actual", () => {
    const tied = [
      star("old-name", 1, "2026-10-01T00:00:00Z"),
      star("gone", 2, "2026-10-02T00:00:00Z"),
    ];
    const now = [
      star("new-name", 1, "2026-10-05T00:00:00Z"),
      star("fresh", 3, "2026-10-06T00:00:00Z"),
    ];
    expect(merge(tied, now)).toEqual([
      star("new-name", 1, "2026-10-01T00:00:00Z"),
      star("gone", 2, "2026-10-02T00:00:00Z"),
      star("fresh", 3, "2026-10-06T00:00:00Z"),
    ]);
  });
});
