import type { Metadata } from "next";
import { BessHomeHero } from "./BessHomeHero";
import { BessPageMotion } from "./BessPageMotion";
import { BessFooter, Symbol } from "./BessShared";
import { BessFrameByFrame } from "./BessFrameByFrame";
import { BessLetters } from "./BessLetters";
import "./bess.css";

export const metadata: Metadata = {
  title: "BESSINSKI — Site officiel",
  description: "Entre indie pop et rock alternatif, découvrez l’univers de Bessinski : des guitares mélodiques, une voix brute, des chansons et des clips à explorer.",
};

export default function Home() {
  return (
    <div className="bess-site" id="top">
      <link rel="preload" as="image" href="/bess/laisse-aller-cover-oct28.webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/bess/laisse-aller-background.webp" imageSrcSet="/bess/laisse-aller-background-960.webp 960w, /bess/laisse-aller-background.webp 1920w, /bess/laisse-aller-background-2560.webp 2560w" imageSizes="100vw" fetchPriority="high" />
      <noscript><style>{".bess-hero-backgrounds,.bess-featured-image img,.bess-header .bess-wordmark,.bess-header .bess-menu-trigger{opacity:1!important;visibility:visible!important}.bess-featured-caption .bess-letter-word>span{opacity:1!important}"}</style></noscript>
      <a className="bess-skip-link" href="#about">Aller au contenu</a>
      <BessPageMotion>
      <main>
        <BessHomeHero />
        <BessFrameByFrame>
          <div className="bess-about-top"><span data-frame-reveal>BASÉ À <b>STRASBOURG</b></span><span data-frame-reveal>ET PARIS, FRANCE<br />DISPONIBLE PARTOUT</span><div data-frame-reveal><strong>MUSICIEN<br />INDÉPENDANT</strong><span>GUITARISTE DE @NAEKO_OFF</span></div></div>
          <div className="bess-about-bio">
            <h2 id="about-heading" data-frame-reveal><BessLetters text="BESS" /><br /><BessLetters text="INSKI" /><Symbol name="eye" /></h2>
            <p data-frame-reveal>Bessinski développe un univers entre indie pop et rock alternatif, porté par des guitares mélodiques et une voix à la sensibilité brute. Un son aux accents nostalgiques, entre douceur et énergie, qui raconte les doutes et les élans du quotidien.</p>
          </div>
          <div className="bess-frame-line" data-frame-reveal aria-hidden="true"><span className="bess-half-circle" /></div>
          <div className="bess-new-release" data-frame-reveal><span className="bess-release-square" aria-hidden="true" /><span>NOUVEAU MORCEAU<strong>AVANT LA FIN D’UN MONDE<br />/ 01.12.2026</strong></span></div>
        </BessFrameByFrame>
      </main>
      <BessFooter />
      </BessPageMotion>
    </div>
  );
}
