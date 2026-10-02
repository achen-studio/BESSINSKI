import type { Metadata } from "next";
import { BessHeader, BessFooter, ListeningLinks, Photo, Symbol } from "../BessShared";
import { BessLetters } from "../BessLetters";
import { BessPageMotion } from "../BessPageMotion";
import { BessVideo } from "../BessVideo";
import { BessLyrics } from "../BessLyrics";
import content from "../figma-content.json";
import "../bess.css";

export const metadata: Metadata = {
  title: "Laisse Aller | BESSINSKI",
  description: "Laisse Aller, Bessinski. Clip réalisé par Kevin Besse, paroles, crédits et images du projet.",
};

export default function Song() {
  return (
    <div className="bess-site bess-song-page" id="top">
      <a className="bess-skip-link" href="#lyrics">Aller aux paroles</a>
      <BessPageMotion>
      <main>
        <section className="bess-song-hero" aria-labelledby="song-title">
          <Photo name="laisse-aller" alt="Portrait de Bessinski dans le clip Laisse Aller" className="bess-song-hero-image" eager />
          <div className="bess-song-hero-shade" aria-hidden="true" />
          <BessHeader />
          <div className="bess-song-heading"><h1 id="song-title"><BessLetters text="LAISSE ALLER" /></h1><div className="bess-song-emblems" data-hero-reveal aria-hidden="true"><span className="bess-half-circle" /><Symbol name="eye" /><span className="bess-half-circle" /></div></div>
          <div className="bess-song-credits"><p data-hero-reveal><BessLetters text="Réal. Kevin Besse" stagger={0.018} /></p><time data-hero-reveal dateTime="2024-06-21"><BessLetters text="21 JUIN 2024" stagger={0.018} /></time><span data-hero-reveal>Cadre : Lucas Muré et Kevin Chomienne<br />Montage, étalonnage et effets visuels : Kevin Besse<br />Production : Bessinski<br />Mixage et mastering : Bessinski et Alex Ikai</span></div>
        </section>
        <div className="bess-song-content">
          <BessVideo />
          <section className="bess-lyrics-section" id="lyrics" aria-label="Paroles et écoute">
            <div className="bess-lyric-feature"><blockquote>PLUS RIEN<br />DANS LA<br />TÊTE<br />PLUS D’ÂME<br />QUE DE LA<br />TECH’<br />PLUS RIEN<br />NE<br />M’INQUIÈTE<br />CAR JE SAIS<br />QUE DEMAIN<br />ÇA BRÛLERA</blockquote><ListeningLinks /></div>
            <BessLyrics lyrics={content.lyrics} />
          </section>
          <section className="bess-with" aria-labelledby="with-heading"><Photo name="with" alt="Bessinski sur le tournage de Laisse Aller" /><div><h2 id="with-heading" data-reveal data-letter-reveal><BessLetters text="WI" /><br /><BessLetters text="TH" /></h2><p data-reveal>Cadre : Lucas Muré et Kevin Chomienne<br />Montage, étalonnage et effets visuels : Kevin Besse<br />Production : Bessinski<br />Mixage et mastering : Bessinski et Alex Ikai</p></div></section>
          <figure className="bess-film-still" data-reveal><Photo name="film-still" alt="Bessinski joue de la guitare près d'une lampe, dans le clip Laisse Aller" /></figure>
          <section className="bess-media" aria-labelledby="media-heading"><div className="bess-media-copy"><h2 id="media-heading" data-reveal data-letter-reveal aria-label="MEDIA"><BessLetters text="M" /><br /><BessLetters text="ED" /><br /><BessLetters text="IA" /></h2><h3 data-reveal>Conception</h3><p data-reveal>{content.conception}</p></div><div className="bess-triptychs"><Photo name="triptych-green" alt="Trois images du clip, guitare et lumières vertes" /><Photo name="triptych-blue" alt="Trois images du clip, portraits au crépuscule" /><Photo name="triptych-red" alt="Trois images du clip, portraits et lumières rouges" /></div></section>
        </div>
      </main>
      <BessFooter dark />
      </BessPageMotion>
    </div>
  );
}
