import assert from "node:assert/strict";
import test from "node:test";
import handler from "../.netlify/functions-internal/server/server.mjs";

test("sormoi2moi uses its Figma content, assets, video and music destinations", async () => {
  const response = await handler(new Request("https://bessinski.test/son/sormoi2moi"));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /sormoi2moi \| BESSINSKI/);
  assert.match(html, /Léa Escalais/);
  assert.match(html, /datetime="2024-09-16"/);
  assert.match(html, /Quitte à perdre la mémoire/);
  assert.match(html, /youtube-nocookie.com\/embed\/wZmVXoRGWPI/);
  assert.doesNotMatch(html, /cc_load_policy=1/);
  for (const asset of ["hero", "with", "film-still", "media-1", "media-2", "media-3"]) {
    assert.ok(html.includes(`/bess/sormoi-${asset}.webp`));
  }
  for (const id of ["2mrF6TbREg7MSjh8ZoF9zl", "1763427791", "3099273221", "381434596", "app=itunes"]) {
    assert.ok(html.includes(id));
  }
  const home = await handler(new Request("https://bessinski.test/"));
  assert.match(await home.text(), /href="\/son\/sormoi2moi"/);
});
