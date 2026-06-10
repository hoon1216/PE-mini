import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariantClasses, type ButtonVariant } from "./button";

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition ${buttonVariantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
