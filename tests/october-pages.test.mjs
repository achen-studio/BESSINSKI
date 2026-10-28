import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access } from "node:fs/promises";
import handler from "../.netlify/functions-internal/server/server.mjs";

test("all four Figma song pages render their own video, lyrics and images", async () => {
  const songs = JSON.parse(await readFile(new URL("../app/songs-content.json", import.meta.url), "utf8"));
  for (const song of Object.values(songs)) {
    const path = song.slug === "laisse-aller" ? "/son" : `/son/${song.slug}`;
    const response = await handler(new Request(`https://bessinski.test${path}`));
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(html.includes(`/embed/${song.video}`), path);
    assert.ok(html.includes(song.date), path);
    for (const image of song.images) {
      assert.ok(html.includes(`/bess/${image.name}.webp`), image.name);
      await access(new URL(`../public/bess/${image.name}.webp`, import.meta.url));
    }
  }
  const html = await (await handler(new Request("https://bessinski.test/"))).text();
  assert.ok(html.includes('href="/son/rever-tue"'));
  assert.ok(html.includes('href="/son/le-ciel-pleure-de-lor"'));
  assert.ok(html.includes('AVANT LA FIN D’UN MONDE'));
  assert.ok(!html.includes('Afficher La nuit est proche'));
});
