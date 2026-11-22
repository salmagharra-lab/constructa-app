import { isHttpUrl, youtubeEmbed } from "@/lib/video";

export default function TaskVideo({ url, label }: { url: string; label: string }) {
  const embed = youtubeEmbed(url);
  if (embed) {
    return (
      <div className="aspect-video overflow-hidden rounded-xl bg-black">
        <iframe
          src={embed}
          title={label}
          className="size-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (!isHttpUrl(url)) return null;
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
    return <video src={url} controls playsInline preload="metadata" className="w-full rounded-xl bg-black" />;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="btn-dark w-full">
      ▶ {label}
    </a>
  );
}
