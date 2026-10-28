import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("header and menu navigation use native links without the client router", async () => {
  const source = await readFile(new URL("../app/BessShared.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']next\/link["']/);
  assert.match(source, /<a className="bess-wordmark" href="\/"/);
  assert.match(source, /<a href="\/"[^>]*><RollingLabel>HOME/);
  assert.match(source, /<a href="\/#about"[^>]*><RollingLabel>ABOUT/);
});
