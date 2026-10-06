export function BessVideo({ videoId = "j8LbANIbjDE", song = "Laisse Aller" }: { videoId?: string; song?: string }) {
  return <figure className="bess-clip bess-video" id="clip" data-reveal>
    {/* Do not force captions: YouTube honors the viewer's own caption preference. */}
    <iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?controls=1&playsinline=1&rel=0`} title={`Bessinski — ${song}, clip officiel`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
  </figure>;
}
