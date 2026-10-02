import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const galleryAssets = ["gallery-01.jpg", "gallery-02.jpg", "gallery-03.jpg"];

async function loadWorker() {
  const workerUrl = new URL("../.netlify/functions-internal/server/server.mjs", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return { fetch: worker };
}

async function render(worker, pathname) {
  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
  );
}

test("server-renders the gallery and the final V13 route", async () => {
  const worker = await loadWorker();

  for (const pathname of ["/archive", "/v13"]) {
    const response = await render(worker, pathname);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

    const html = await response.text();
    assert.match(html, /<title>Album Archive/);
    assert.match(html, /ALBUM ARCHIVE/);
    assert.match(html, /<canvas[^>]+aria-label="Galerie /);
    assert.doesNotMatch(html, /Your site is taking shape|Building your site/);

    if (pathname === "/v13") {
      assert.match(html, /Afficher la carte 1/);
      assert.match(html, /Afficher la carte 2/);
      assert.match(html, /Afficher la carte 3/);
    }
  }
});

test("server-renders Home and SON with their Figma content and navigation", async () => {
  const worker = await loadWorker();
  const home = await render(worker, "/");
  assert.equal(home.status, 200);
  const homeHtml = await home.text();
  assert.match(homeHtml, /BESSINSKI \| Home/);
  assert.match(homeHtml, /href="\/son"/);
  assert.match(homeHtml, /id="about"/);
  assert.match(homeHtml, /id="songs"/);
  assert.match(homeHtml, /\/bess\/portrait.webp/);
  assert.match(homeHtml, /class="bess-frame-section"/);
  assert.match(homeHtml, /src="\/bess\/framebyframe.mp4"/);
  assert.match(homeHtml, /<canvas[^>]+class="bess-hero-canvas"/);
  assert.equal([...homeHtml.matchAll(/aria-label="Afficher /g)].length, 4);
  assert.match(homeHtml, /aria-label="Afficher Laisse Aller" aria-pressed="true"/);
  assert.equal([...homeHtml.matchAll(/class="bess-song-preview"/g)].length, 8, "footer and menu each contain four release previews");
  assert.match(homeHtml, /Listen to my music/);
  assert.match(homeHtml, /href="https:\/\/www.instagram.com\/bessinski\/"/);
  assert.match(homeHtml, /href="https:\/\/www.youtube.com\/@bessinski"/);
  assert.match(homeHtml, /CREATED BY A\.\/CHEN STUDIO/);
  assert.match(homeHtml, /class="bess-song-name">Laisse Aller/);
  assert.doesNotMatch(homeHtml, /class="bess-song-name">Je refais/);
  assert.match(homeHtml, /tidal.com\/artist\/9265915/);
  assert.match(homeHtml, /open.spotify.com\/intl-fr\/artist\/0p1xkwZnfEiugIXYvwW2F8/);
  assert.match(homeHtml, /deezer.com\/fr\/artist\/13518497/);
  assert.match(homeHtml, /CLOSE/);
  assert.match(homeHtml, /data-letter-reveal/);
  assert.doesNotMatch(homeHtml, /NIGHT IS COMING/);
  assert.match(homeHtml, /aria-haspopup="dialog"/);
  assert.match(homeHtml, /href="https:\/\/a-chen.webflow.io\/"/);
  for (const name of ["le-ciel", "la-nuit", "laisse-aller", "sormoi"]) {
    assert.match(homeHtml, new RegExp(`/bess/${name}-background.webp`));
  }

  const song = await render(worker, "/son");
  assert.equal(song.status, 200);
  const songHtml = await song.text();
  assert.match(songHtml, /Laisse Aller \| BESSINSKI/);
  assert.match(songHtml, /id="lyrics"/);
  assert.match(songHtml, /Kevin Besse/);
  assert.match(songHtml, /\/bess\/triptych-red.webp/);
  assert.match(songHtml, /open.spotify.com\/album\/2DSVaQLK2v49kHwPdCb2Gs/);
  assert.match(songHtml, /youtube-nocookie.com\/embed\/j8LbANIbjDE/);
  assert.match(songHtml, /class="bess-song-emblems"/);
  assert.match(songHtml, /class="bess-song-hero-shade"/);
  assert.match(songHtml, /class="bess-lyrics-lens"/);
  assert.match(songHtml, /Lyrics :/);
  assert.equal([...homeHtml.matchAll(/class="bess-back-top"/g)].length, 1);
  assert.doesNotMatch(songHtml, /<h2[^>]*>Paroles<\/h2>/);
  assert.match(songHtml, /href="https:\/\/tidal.com\/album\/368720031"/);
  assert.match(homeHtml, /\/bess\/itunes.svg/);
  assert.match(homeHtml, /\/bess\/tidal.svg/);

  for (const html of [homeHtml, songHtml]) {
    const assets = new Set([...html.matchAll(/src="(\/bess\/[^"?]+)"/g)].map(match => match[1]));
    assert.ok(assets.size > 0);
    for (const asset of assets) await access(new URL(`../public${asset}`, import.meta.url));
  }
});

test("keeps every gallery image inside the project", async () => {
  const publicRoot = new URL("../public/", import.meta.url);
  const publicFiles = await readdir(publicRoot);
  const componentSource = await Promise.all([
    readFile(new URL("../app/GalleryCarousel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OverlappingScrollCarousel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PageMeshCarousel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ThreeCardGallery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/VerticalExitCarousel.tsx", import.meta.url), "utf8"),
  ]);
  const combinedSource = componentSource.join("\n");

  for (const assetName of galleryAssets) {
    assert.ok(publicFiles.includes(assetName));
    const assetUrl = new URL(assetName, publicRoot);
    await access(assetUrl);
    assert.ok((await stat(assetUrl)).size > 0);
    assert.match(combinedSource, new RegExp(`/${assetName}`));
  }

  assert.doesNotMatch(
    combinedSource,
    /\/Users\/|\/var\/folders\/|file:\/\/|Desktop\//,
  );
});
