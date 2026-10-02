import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUp, ArrowUpRight, ArrowRight } from "lucide-react";
import { artistLinks, artistListeningLinks, listeningLinks, releases } from "./bess-content";
import { BessLetters } from "./BessLetters";
import { BessMenu } from "./BessMenu";

export function Symbol({ name, className = "" }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={`bess-symbol ${className}`} style={{ "--symbol": `url(/bess/${name}.svg)` } as CSSProperties} />;
}

export function Photo({ name, alt = "", className = "", eager = false }: { name: string; alt?: string; className?: string; eager?: boolean }) {
  // These local WebP assets are already resized and compressed from the Figma originals.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/bess/${name}.webp`} srcSet={name.endsWith('-background') ? `/bess/${name}-960.webp 960w, /bess/${name}.webp 1920w, /bess/${name}-2560.webp 2560w` : undefined} sizes={name.endsWith('-background') ? "100vw" : undefined} alt={alt} className={className} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" draggable={false} />;
}

export function RollingLabel({ children }: { children: string }) {
  return <span className="bess-rolling-label"><span><BessLetters text={children} /></span><span aria-hidden="true">{children}</span></span>;
}

export function BessHeader() {
  return (
    <header className="bess-header">
      <Link className="bess-wordmark" href="/" aria-label="Bessinski, accueil"><BessLetters text="BESSINSKI" /><Symbol name="eye" /></Link>
      <BessMenu><BessFooter menu /></BessMenu>
    </header>
  );
}

export function BessFooter({ dark = false, menu = false }: { dark?: boolean; menu?: boolean }) {
  const prefix = menu ? "menu-" : "";
  return (
    <footer className={`bess-footer ${dark ? "bess-footer-dark" : ""}`}>
      <nav aria-label="Navigation principale" className="bess-footer-nav">
        <Link href="/" className="bess-nav-link" data-reveal><RollingLabel>HOME</RollingLabel><ArrowUpRight aria-hidden="true" /></Link>
        <Link href="/#about" className="bess-nav-link" data-reveal><RollingLabel>ABOUT</RollingLabel><ArrowUpRight aria-hidden="true" /></Link>
        <section id={`${prefix}songs`} className="bess-songs" aria-labelledby={`${prefix}songs-heading`}>
          <h2 id={`${prefix}songs-heading`} data-reveal data-letter-reveal><BessLetters text="MY SONGS" /></h2>
          <div className="bess-song-list" data-reveal>
          {releases.map(release => (
            <a className="bess-song-row" key={release.title} href={release.href} target="_blank" rel="noreferrer">
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
        <a className="bess-credit bess-email bess-nav-link" href="https://a-chen.webflow.io/" target="_blank" rel="noreferrer" data-reveal><RollingLabel>CREATED BY A./CHEN STUDIO 未來界</RollingLabel><ArrowUpRight aria-hidden="true" /></a>
        <div className="bess-contact" data-reveal>
          <a className="bess-email bess-nav-link" href="mailto:hello@bessinski.com"><RollingLabel>hello@bessinski.com</RollingLabel><ArrowUpRight aria-hidden="true" /></a>
          <p>Based in Strasbourg and Paris, France.<br />Available worldwide.</p>
          <p className="bess-guitarist">Guitarist for @naeko_off</p>
          <strong className="bess-listen-label">Listen to my music</strong>
          <div className="bess-social-icons">
            {artistListeningLinks.map(link => (
              <a key={link.name} href={link.href} target="_blank" rel="noreferrer" aria-label={`Écouter sur ${link.name}`} title={link.name}>{link.icon ? <Symbol name={link.icon} /> : <span>TIDAL</span>}</a>
            ))}
          </div>
          {!menu && <a className="bess-back-top" href="#top"><RollingLabel>BACK TO TOP</RollingLabel><ArrowUp aria-hidden="true" size={18} /></a>}
        </div>
        <div className="bess-social-names" data-reveal>
          {([['YouTube', artistLinks.youtube], ['Instagram', artistLinks.instagram]] as const).map(([label, href]) => href ? <a key={label} href={href} target="_blank" rel="noreferrer"><RollingLabel>{label}</RollingLabel><ArrowUpRight aria-hidden="true" /></a> : <span key={label} title="Lien officiel à confirmer">{label}</span>)}
        </div>
      </div>
    </footer>
  );
}

export function ListeningLinks() {
  return <div className="bess-platforms" aria-label="Écouter Laisse Aller">{listeningLinks.map(link => <a key={link.name} href={link.href} target="_blank" rel="noreferrer"><span className="bess-platform-name"><Symbol name={link.icon} />{link.name}</span><span className="bess-platform-line" /><span>{link.action}</span><ArrowRight size={18} aria-hidden="true" /></a>)}</div>;
}
