export const listeningLinks = [
  { name: "Spotify", icon: "spotify", href: "https://open.spotify.com/album/2DSVaQLK2v49kHwPdCb2Gs", action: "Play" },
  { name: "Apple Music", icon: "apple", href: "https://music.apple.com/us/album/laisse-aller-single/1751575234", action: "Play" },
  { name: "Deezer", icon: "deezer", href: "https://www.deezer.com/album/601318792", action: "Play" },
  { name: "iTunes Store", icon: "itunes", href: "https://music.apple.com/us/album/laisse-aller-single/1751575234?app=itunes", action: "Buy" },
  { name: "Tidal", icon: "tidal", href: "https://tidal.com/album/368720031", action: "Play" },
];

export const latestRelease = { title: "Je refais la même", href: "https://snd.click/ovv4" };
export const sormoiListeningLinks = [
  { name: "Spotify", icon: "spotify", href: "https://open.spotify.com/track/2mrF6TbREg7MSjh8ZoF9zl", action: "Play" },
  { name: "Apple Music", icon: "apple", href: "https://music.apple.com/fr/album/sormoi2moi/1763427790?i=1763427791", action: "Play" },
  { name: "Deezer", icon: "deezer", href: "https://www.deezer.com/track/3099273221", action: "Play" },
  { name: "iTunes Store", icon: "itunes", href: "https://music.apple.com/fr/album/sormoi2moi/1763427790?i=1763427791&app=itunes", action: "Buy" },
  { name: "Tidal", icon: "tidal", href: "https://listen.tidal.com/track/381434596", action: "Play" },
];
export const artistListeningLinks = [
  { name: "Spotify", icon: "spotify", href: "https://open.spotify.com/intl-fr/artist/0p1xkwZnfEiugIXYvwW2F8" },
  { name: "Apple Music", icon: "apple", href: "https://music.apple.com/us/artist/bessinski/1309871856" },
  { name: "Deezer", icon: "deezer", href: "https://www.deezer.com/fr/artist/13518497" },
  { name: "iTunes Store", icon: "itunes", href: "https://music.apple.com/us/artist/bessinski/1309871856" },
  { name: "Tidal", icon: "tidal", href: "https://tidal.com/artist/9265915" },
];

export const releases = [
  { title: "Laisse Aller", image: "laisse-aller", href: "/son" },
  { title: "La nuit est proche", image: "la-nuit", href: "https://music.apple.com/us/album/la-nuit-est-proche/1780472268" },
  { title: "Le ciel pleure de l'or", image: "le-ciel", href: "https://music.apple.com/us/album/le-ciel-pleure-de-lor/1508420117" },
  { title: "sormoi2moi", image: "sormoi", href: "/son/sormoi2moi" },
];

// Fill these with the artist's confirmed destinations before publication.
export const artistLinks: { youtube: string | null; instagram: string | null; clip: string | null } = {
  youtube: "https://www.youtube.com/@bessinski",
  instagram: "https://www.instagram.com/bessinski/",
  clip: "https://www.youtube.com/watch?v=j8LbANIbjDE",
};
