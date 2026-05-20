import { cn } from "@/lib/insome/ui";

interface ShinyTextProps {
  readonly text: string;
  readonly variant?: "on-dark" | "on-light";
  readonly className?: string;
}

export function ShinyText({ text, variant = "on-dark", className }: ShinyTextProps) {
  return (
    <span
      className={cn(
        "shiny-text inline-block",
        variant === "on-dark" ? "shiny-text--on-dark" : "shiny-text--on-light",
        className,
      )}
    >
      {text}
    </span>
  );
}
