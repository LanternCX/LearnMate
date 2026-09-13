import { ArrowRight } from "lucide-react";
import { productUrl } from "../../website-content";
import { ActionButton, ActionLink } from "../ui/Action";

export function ProductLink({ compact = false }: { compact?: boolean }) {
  const size = compact ? "compact" : "default";
  return productUrl
    ? <ActionLink href={productUrl} size={size}>进入知芽<ArrowRight aria-hidden="true" /></ActionLink>
    : <ActionButton disabled size={size}>进入知芽<ArrowRight aria-hidden="true" /></ActionButton>;
}
