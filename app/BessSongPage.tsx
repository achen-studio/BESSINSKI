import type { CSSProperties } from "react";
import { BessHeader, BessFooter, ListeningLinks, Photo, Symbol } from "./BessShared";
import { BessLetters } from "./BessLetters";
import { BessPageMotion } from "./BessPageMotion";
import { BessVideo } from "./BessVideo";
import { BessLyrics } from "./BessLyrics";
import { listeningLinks, sormoiListeningLinks, cielListeningLinks, reverListeningLinks } from "./bess-content";
import songs from "./songs-content.json";
import "./bess.css";

export type SongSlug = keyof typeof songs;

export function BessSongPage({ slug }: { slug: SongSlug }) {
  const song = songs[slug];
  const links = { "laisse-aller": listeningLinks, sormoi2moi: sormoiListeningLinks, "le-ciel-pleure-de-lor": cielListeningLinks, "rever-tue": reverListeningLinks }[slug];
  const lines = slug === "le-ciel-pleure-de-lor" ? ["LE CIEL", "PLEURE DE L’OR"] : [song.title.toUpperCase()];
  return <div className={`bess-site bess-song-page bess-song-${slug}`} id="top">
    <a className="bess-skip-link" href="#lyrics">Aller aux paroles</a>
    <BessPageMotion><main>
      <section className="bess-song-hero" aria-labelledby="song-title">
        <Photo name={song.images[0].name} alt={`${song.title}, visuel du clip`} className="bess-song-hero-image" eager />
        <div className="bess-song-hero-shade" aria-hidden="true" />
        <BessHeader />
        <div className="bess-song-heading">
          <h1 id="song-title">{lines.map(line => <span className="bess-song-title-line" key={line}><BessLetters text={line} /></span>)}</h1>
          <div className="bess-song-emblems" data-hero-reveal aria-hidden="true"><span className="bess-half-circle" /><Symbol name="eye" /><span className="bess-half-circle" /></div>
        </div>
        <div className="bess-song-credits">
          <p data-hero-reveal><BessLetters text={song.by} stagger={0.018} /></p>
          <time data-hero-reveal dateTime={song.date}><BessLetters text={song.dateLabel} stagger={0.018} /></time>
          <span className="bess-song-credit-lines" data-hero-reveal>{song.credits}</span>
        </div>
      </section>
      <div className="bess-song-content">
        <BessVideo videoId={song.video} song={song.title} />
        <section className="bess-lyrics-section" id="lyrics" aria-label="Paroles et écoute">
          <div className="bess-lyric-feature"><blockquote>{song.quote}</blockquote><ListeningLinks links={links} song={song.title} /></div>
          <BessLyrics lyrics={song.lyrics} />
        </section>
        <section className="bess-with" aria-labelledby="with-heading">
          <Photo name={song.images[1].name} alt={`${song.title}, portrait de tournage`} />
          <div><h2 id="with-heading" data-reveal data-letter-reveal><BessLetters text="WI" /><br /><BessLetters text="TH" /></h2><p className="bess-song-credit-lines" data-reveal>{song.withCredits}</p></div>
        </section>
        <figure className="bess-film-still" data-reveal><Photo name={song.images[2].name} alt={`Extrait de ${song.title}`} /></figure>
        <section className="bess-media" aria-labelledby="media-heading">
          <div className="bess-media-copy"><h2 id="media-heading" data-reveal data-letter-reveal aria-label="MEDIA"><BessLetters text="M" /><br /><BessLetters text="ED" /><br /><BessLetters text="IA" /></h2><h3 data-reveal>Conception</h3><p data-reveal>{song.conception}</p></div>
          <div className="bess-triptychs">{song.images.slice(3).map((image, index) => <div key={image.name} className="bess-media-image" style={{ "--media-ratio": image.ratio } as CSSProperties}><Photo name={image.name} alt={`${song.title}, photographie ${index + 1}`} /></div>)}</div>
        </section>
      </div>
    </main><BessFooter dark /></BessPageMotion>
  </div>;
}
