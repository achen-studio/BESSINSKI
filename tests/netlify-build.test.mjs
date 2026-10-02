import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("Netlify output routes pages to Nitro and preserves public assets", async () => {
  const { default: handler, config } = await import("../.netlify/functions-internal/server/server.mjs");
  assert.equal(config.path, "/*");
  assert.equal(config.preferStatic, true);
  const metadata = JSON.parse(await readFile(new URL("../.netlify/functions-internal/nitro.json", import.meta.url), "utf8"));
  assert.equal(metadata.preset, "netlify");

  for (const pathname of ["/", "/son"]) {
    const response = await handler(new Request(`https://bessinski.test${pathname}`));
    assert.equal(response.status, 200);
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="(\/(?:_next\/static|bess|fonts)\/[^"?]+)"/g)];
    assert.ok(assets.length > 0);
    for (const [, asset] of assets) {
      await access(new URL(`../dist${asset}`, import.meta.url));
    }
  }
  await access(new URL("../dist/bess/framebyframe.mp4", import.meta.url));
  const missing = await handler(new Request("https://bessinski.test/nonexistent-page"));
  assert.equal(missing.status, 404);
});
