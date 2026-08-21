import type { SVGProps } from "react";

export interface LogoMarkProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Abstract radar/target mark: concentric rings sweeping toward a detected
 * signal (the offset dot). Uses currentColor so it inherits theme color.
 */
export function LogoMark({ size = 24, ...props }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="14" cy="16" r="11" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <circle cx="14" cy="16" r="6.5" stroke="currentColor" strokeWidth="2" opacity="0.65" />
      <circle cx="14" cy="16" r="2" fill="currentColor" />
      <path d="M14 16L23 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="7" r="3" fill="currentColor" />
    </svg>
  );
}

export interface LogoProps extends SVGProps<SVGSVGElement> {
  size?: number;
  wordmarkClassName?: string;
}

export function Logo({ size = 24, wordmarkClassName, ...props }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} {...props} />
      <span className={wordmarkClassName ?? "text-lg font-semibold tracking-tight"}>LeadRadar</span>
    </span>
  );
}
