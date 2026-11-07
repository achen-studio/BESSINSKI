/* Native navigation avoids the vinext client-router failure in the Netlify build. */
/* eslint-disable @next/next/no-html-link-for-pages */
import type { CSSProperties } from "react";
import { ArrowUp, ArrowUpRight, ArrowRight, FaceSlightlySmiling } from "lucide-react";
import { artistLinks, artistListeningLinks, listeningLinks, releases } from "./bess-content";
import { BessLetters } from "./BessLetters";
import { BessMenu } from "./BessMenu";

export function Symbol({ name, className = "" }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={`bess-symbol ${className}`} style={{ "--symbol": `url(/bess/${name}.svg)` } as CSSProperties} />;
}

export function Photo({ name, alt = "", className = "", eager = false, decoding = "async" }: { name: string; alt?: string; className?: string; eager?: boolean; decoding?: "async" | "sync" | "auto" }) {
  // These local WebP assets are already resized and compressed from the Figma originals.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/bess/${name}.webp`} srcSet={name.endsWith('-background') ? `/bess/${name}-960.webp 960w, /bess/${name}.webp 1920w, /bess/${name}-2560.webp 2560w` : undefined} sizes={name.endsWith('-background') ? "100vw" : undefined} alt={alt} className={className} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding={decoding} draggable={false} />;
}

export function RollingLabel({ children }: { children: string }) {
  return <span className="bess-rolling-label"><span><BessLetters text={children} /></span><span aria-hidden="true">{children}</span></span>;
}

export function BessHeader() {
  return (
    <header className="bess-header">
      <a className="bess-wordmark" href="/" aria-label="Bessinski, accueil"><BessLetters text="BESSINSKI" /></a>
      <BessMenu><BessFooter menu /></BessMenu>
    </header>
  );
}

export function BessFooter({ dark = false, menu = false }: { dark?: boolean; menu?: boolean }) {
  const prefix = menu ? "menu-" : "";
  return (
    <footer className={`bess-footer ${dark ? "bess-footer-dark" : ""}`}>
      <nav aria-label="Navigation principale" className="bess-footer-nav">
        <a href="/" className="bess-nav-link" data-reveal><RollingLabel>ACCUEIL</RollingLabel><ArrowUpRight aria-hidden="true" /></a>
        <a href="/#about" className="bess-nav-link" data-reveal><RollingLabel>À PROPOS</RollingLabel><ArrowUpRight aria-hidden="true" /></a>
        <section id={`${prefix}songs`} className="bess-songs" aria-labelledby={`${prefix}songs-heading`}>
          <h2 id={`${prefix}songs-heading`} data-reveal data-letter-reveal><BessLetters text="MES SONS" /></h2>
          <div className="bess-song-list" data-reveal>
          {releases.map(release => (
            <a className="bess-song-row" key={release.title} href={release.href}>
              <span className="bess-song-name">{release.title}</span>
              <span className="bess-song-preview" aria-hidden="true"><Photo name={release.image} /></span>
              <span className="bess-song-action"><RollingLabel>Play</RollingLabel><ArrowUpRight aria-hidden="true" /></span>
            </a>
          ))}
          </div>
        </section>
        <a href="mailto:hello@bessinski.com" className="bess-nav-link" data-reveal><RollingLabel>CONTACT</RollingLabel><ArrowUpRight aria-hidden="true" /></a>
      </nav>
      <div className="bess-footer-bottom" id={`${prefix}contact`}>
        <div className="bess-creator" data-reveal>
          <FaceSlightlySmiling size={24} aria-hidden="true" />
          <p>Want a site this cool?<br />Contact me.</p>
          <a className="bess-creator-email bess-email bess-nav-link" href="mailto:achen.creation@gmail.com"><RollingLabel>achen.creation@gmail.com</RollingLabel><ArrowUpRight aria-hidden="true" /></a>
          <a className="bess-credit bess-email bess-nav-link" href="https://a-chen.webflow.io/" target="_blank" rel="noreferrer"><RollingLabel>CREATED BY A./CHEN STUDIO</RollingLabel>{" "}<RollingLabel>未來界</RollingLabel><ArrowUpRight aria-hidden="true" /></a>
        </div>
        <div className="bess-contact" data-reveal>
          <p>Basé à Strasbourg et Paris, France.<br />Disponible partout dans le monde.</p>
          <p className="bess-guitarist">Guitariste de <a href="https://www.instagram.com/naeko_off/?hl=en" target="_blank" rel="noopener noreferrer">@naeko_off</a></p>
          <strong className="bess-listen-label">Écouter ma musique</strong>
          <div className="bess-social-icons">
            {artistListeningLinks.map(link => (
              <a key={link.name} href={link.href} target="_blank" rel="noreferrer" aria-label={`Écouter sur ${link.name}`} title={link.name}>{link.icon ? <Symbol name={link.icon} /> : <span>TIDAL</span>}</a>
            ))}
          </div>
        </div>
        <div className="bess-social-names" data-reveal>
          {([['YouTube', artistLinks.youtube], ['Instagram', artistLinks.instagram]] as const).map(([label, href]) => href ? <a key={label} href={href} target="_blank" rel="noreferrer"><RollingLabel>{label}</RollingLabel></a> : <span key={label} title="Lien officiel à confirmer">{label}</span>)}
        </div>
        {!menu && <a className="bess-back-top" href="#top"><RollingLabel>RETOUR EN HAUT</RollingLabel><ArrowUp aria-hidden="true" size={18} /></a>}
      </div>
    </footer>
  );
}

export function ListeningLinks({ links = listeningLinks, song = "Laisse Aller" }: { links?: typeof listeningLinks; song?: string }) {
  return <div className="bess-platforms" aria-label={`Écouter ${song}`}>{links.map(link => <a key={link.name} href={link.href} target="_blank" rel="noreferrer"><span className="bess-platform-name"><Symbol name={link.icon} />{link.name}</span><span className="bess-platform-line" /><span>{link.action}</span><ArrowRight size={18} aria-hidden="true" /></a>)}</div>;
}
