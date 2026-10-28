import type { Metadata } from "next";
import { BessHomeHero } from "./BessHomeHero";
import { BessPageMotion } from "./BessPageMotion";
import { BessFooter, Symbol } from "./BessShared";
import { BessFrameByFrame } from "./BessFrameByFrame";
import { BessLetters } from "./BessLetters";
import "./bess.css";

export const metadata: Metadata = {
  title: "BESSINSKI | Home",
  description: "Bessinski, musicien indépendant. Un univers entre indie pop et rock alternatif. Musique, clips et nouvelles sorties.",
};

export default function Home() {
  return (
    <div className="bess-site" id="top">
      <a className="bess-skip-link" href="#about">Aller au contenu</a>
      <BessPageMotion>
      <main>
        <BessHomeHero />
        <BessFrameByFrame>
          <div className="bess-about-top"><span data-frame-reveal>BASED IN <b>STRASBOURG</b></span><span data-frame-reveal>AND PARIS, FR<br />WORKING WORLDWIDE</span><div data-frame-reveal><strong>INDEPENDENT<br />MUSICIAN</strong><span>GUITARIST FOR @NAEKO_OFF</span></div></div>
          <div className="bess-about-bio">
            <h2 id="about-heading" data-frame-reveal><BessLetters text="BESS" /><br /><BessLetters text="INSKI" /><Symbol name="eye" /></h2>
            <p data-frame-reveal>Bessinski développe un univers entre indie pop et rock alternatif, porté par des guitares mélodiques et une voix à la sensibilité brute. Un son aux accents nostalgiques, entre douceur et énergie, qui raconte les doutes et les élans du quotidien.</p>
          </div>
          <div className="bess-frame-line" data-frame-reveal aria-hidden="true"><span className="bess-half-circle" /></div>
          <div className="bess-new-release" data-frame-reveal><span className="bess-release-square" aria-hidden="true" /><span>NEW SONG<strong>AVANT LA FIN D’UN MONDE / 01.12.2026</strong></span></div>
        </BessFrameByFrame>
      </main>
      <BessFooter />
      </BessPageMotion>
    </div>
  );
}
