import type { Metadata } from "next";
import { BessHeader, BessFooter, ListeningLinks, Photo, Symbol } from "../../BessShared";
import { BessLetters } from "../../BessLetters";
import { BessPageMotion } from "../../BessPageMotion";
import { BessVideo } from "../../BessVideo";
import { BessLyrics } from "../../BessLyrics";
import { sormoiListeningLinks } from "../../bess-content";
import content from "../../sormoi-content.json";
import "../../bess.css";

export const metadata: Metadata = {
  title: "sormoi2moi | BESSINSKI",
  description: "sormoi2moi, Bessinski. Clip réalisé par Kévin Besse avec Léa Escalais, paroles, crédits et images du projet.",
};

function Credits() {
  return <>Production, mixage et mastering : Bessinski<br />Réalisation : Kévin Besse<br />Modèle : Léa Escalais</>;
}

export default function Sormoi2moi() {
  return (
    <div className="bess-site bess-song-page bess-sormoi-page" id="top">
      <a className="bess-skip-link" href="#lyrics">Aller aux paroles</a>
      <BessPageMotion>
        <main>
          <section className="bess-song-hero" aria-labelledby="song-title">
            <Photo name="sormoi-hero" alt="Léa Escalais avec un téléviseur dans le clip sormoi2moi" className="bess-song-hero-image" eager />
            <div className="bess-song-hero-shade" aria-hidden="true" />
            <BessHeader />
            <div className="bess-song-heading">
              <h1 id="song-title"><BessLetters text="SORMOI2MOI" /></h1>
              <div className="bess-song-emblems" data-hero-reveal aria-hidden="true"><span className="bess-half-circle" /><Symbol name="eye" /><span className="bess-half-circle" /></div>
            </div>
            <div className="bess-song-credits">
              <p data-hero-reveal><BessLetters text="Réal. Kévin Besse" stagger={0.018} /></p>
              <time data-hero-reveal dateTime="2024-09-16"><BessLetters text="16 SEPT. 2024" stagger={0.018} /></time>
              <span data-hero-reveal><Credits /></span>
            </div>
          </section>
          <div className="bess-song-content">
            <BessVideo videoId="wZmVXoRGWPI" song="sormoi2moi" />
            <section className="bess-lyrics-section" id="lyrics" aria-label="Paroles et écoute">
              <div className="bess-lyric-feature">
                <blockquote>SORS-MOI<br />DE MOI<br />QUE JE NE<br />SENTE PLUS<br />LES LOIS<br />DES HOMMES,<br />DES ROIS,<br />DES PROPHÈTES</blockquote>
                <ListeningLinks links={sormoiListeningLinks} song="sormoi2moi" />
              </div>
              <BessLyrics lyrics={content.lyrics} />
            </section>
            <section className="bess-with" aria-labelledby="with-heading">
              <Photo name="sormoi-with" alt="Portrait de Léa Escalais sur fond rouge" />
              <div><h2 id="with-heading" data-reveal data-letter-reveal><BessLetters text="WI" /><br /><BessLetters text="TH" /></h2><p data-reveal><Credits /></p></div>
            </section>
            <figure className="bess-film-still" data-reveal><Photo name="sormoi-film-still" alt="Le visage de Bessinski dans un téléviseur, extrait du clip sormoi2moi" /></figure>
            <section className="bess-media" aria-labelledby="media-heading">
              <div className="bess-media-copy"><h2 id="media-heading" data-reveal data-letter-reveal aria-label="MEDIA"><BessLetters text="M" /><br /><BessLetters text="ED" /><br /><BessLetters text="IA" /></h2><h3 data-reveal>Conception</h3><p data-reveal>{content.conception}</p></div>
              <div className="bess-triptychs"><Photo name="sormoi-media-1" alt="Léa Escalais accoudée au téléviseur" /><Photo name="sormoi-media-2" alt="Léa Escalais debout avec le téléviseur" /><Photo name="sormoi-media-3" alt="Léa Escalais assise avec le téléviseur" /></div>
            </section>
          </div>
        </main>
        <BessFooter dark />
      </BessPageMotion>
    </div>
  );
}
