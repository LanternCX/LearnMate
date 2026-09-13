import type { ReactNode } from "react";

type FeatureCardProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  media?: ReactNode;
  note?: string;
};

export function FeatureCard({ title, description, icon, media, note }: FeatureCardProps) {
  return <article className="feature-item">
    {media}
    {icon}
    <h3>{title}</h3>
    <p>{description}</p>
    {note && <span className="feature-note">{note}</span>}
  </article>;
}
