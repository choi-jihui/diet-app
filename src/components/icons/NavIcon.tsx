import type { NavIconName } from "@/constants/navigation";

interface NavIconProps {
  name: NavIconName;
  className?: string;
}

export function NavIcon({ name, className = "h-5 w-5" }: NavIconProps) {
  switch (name) {
    case "home":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "fridge":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="6" y="3" width="12" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M6 10h12M9 6.5v2M9 13v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "meal":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 12c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M6 12H4M20 12h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "cardio":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4.5 12.5c2-3 4-3 6 0s4 3 6 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "log":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "report":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 20V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M5 20h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M9 16v-4M13 16v-7M17 16v-3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
