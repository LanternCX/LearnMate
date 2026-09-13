import { useState } from "react";

type TeachingImage = {
  src: string;
  alt: string;
};

export function TeachingMedia({ image }: { image: TeachingImage }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <figure className="teaching-media" aria-label={image.alt}>
    {image.src && failedSrc !== image.src && <img src={image.src} alt={image.alt} width="1600" height="1000"
      loading="lazy" onError={() => setFailedSrc(image.src)} />}
  </figure>;
}
