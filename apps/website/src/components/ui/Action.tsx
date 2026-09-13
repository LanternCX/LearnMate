import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type ActionVariant = "accent" | "neutral";
type ActionSize = "default" | "compact";

function actionClassName(variant: ActionVariant, size: ActionSize, className?: string) {
  return [variant === "accent" ? "product-link" : "text-action", size === "compact" && "compact", className]
    .filter(Boolean)
    .join(" ");
}

type ActionLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ActionVariant;
  size?: ActionSize;
};

export function ActionLink({ variant = "accent", size = "default", className, ...props }: ActionLinkProps) {
  return <a className={actionClassName(variant, size, className)} {...props} />;
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionVariant;
  size?: ActionSize;
};

export function ActionButton({ variant = "accent", size = "default", className, type = "button", ...props }: ActionButtonProps) {
  return <button className={actionClassName(variant, size, className)} type={type} {...props} />;
}
