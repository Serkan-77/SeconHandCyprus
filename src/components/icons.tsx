import type { SVGProps } from "react";

const paths: Record<string, string> = {
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8",
  home: "M3 10l9-7 9 7v11h-7v-7h-4v7H3z",
  plus: "M12 5v14M5 12h14",
  chat: "M21 11.5a9 9 0 0 1-9 9 9 9 0 0 1-4-.9L3 21l1.4-5a9 9 0 1 1 16.6-4.5M8 10h8M8 14h5",
  user: "M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  back: "M15 5l-7 7 7 7",
  chevron: "M9 5l7 7-7 7",
  close: "M6 6l12 12M18 6 6 18",
  check: "M5 12l4 4L19 6",
  shield: "M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6",
  camera: "M4 6h4l2-3h4l2 3h4v14H4zM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  sofa: "M5 12V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5M4 19v2M20 19v2M3 11h3v4h12v-4h3v8H3z",
  phone: "M7 2h10v20H7zM11 18h2",
  shirt: "M8 3l4 2 4-2 6 4-3 5-3-2v12H8V10l-3 2-3-5z",
  bike: "M9 16a4 4 0 1 1-8 0 4 4 0 0 1 8 0M23 16a4 4 0 1 1-8 0 4 4 0 0 1 8 0M5 16l4-9 5 9H5M9 7h8l2 9M16 4h3M8 4H6",
  car: "M3 12l3-7h12l3 7v8h-3v-3H6v3H3zM3 12h18M6 14h2M16 14h2",
  book: "M12 5c-4-3-8-2-10-1v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-1-7-2-10 1zM12 5v15",
  filter: "M4 7h16M4 17h16M8 4v6M16 14v6",
  sort: "M8 4v16l-4-4M8 20l4-4M15 4h5M15 9h4M15 14h3",
  share: "M12 16V2M7 7l5-5 5 5M5 11H3v11h18V11h-2",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  send: "M22 2L9 15M22 2l-7 20-6-7-7-6z",
  logout: "M9 4H3v16h6M14 7l5 5-5 5M8 12h11",
  settings:
    "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  globe: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M2 12h20M12 2c-6 6-6 14 0 20 6-6 6-14 0-20",
  moon: "M21 13A9 9 0 0 1 11 3 9 9 0 1 0 21 13",
  sun: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  flag: "M4 22V3M4 3h15l-3 5 3 5H4",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2",
  image: "M3 3h18v18H3zM3 17l6-6 5 5 3-3 4 4M8 7h.01",
  bag: "M5 7h14l2 15H3zM8 7V5a4 4 0 0 1 8 0v2",
  store: "M3 9l2-5h14l2 5M3 9v11h18V9M3 9h18M9 20v-6h6v6",
  spark: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  chart: "M3 3v18h19M6 15l5-5 4 3 6-8",
  users: "M16 21v-2a6 6 0 0 0-12 0v2M14 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M18 3a4 4 0 0 1 0 8M20 15a5 5 0 0 1 3 4v2",
  mail: "M2 4h20v16H2zM2 4l10 9L22 4",
  lock: "M5 10h14v12H5zM8 10V6a4 4 0 0 1 8 0v4M12 15v3",
  wifi: "M2 8c6-6 14-6 20 0M5 12c4-4 10-4 14 0M9 16c2-2 4-2 6 0M12 20h.01",
  battery: "M2 7h17v10H2zM22 10v4M5 10h10v4H5",
  eye: "M1 12c6-10 16-10 22 0-6 10-16 10-22 0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  eyeOff: "M3 3l18 18M10.6 5.1C16 4.4 20.3 7.4 23 12c-.8 1.4-1.8 2.7-2.9 3.7M6.6 6.6C4.4 7.8 2.6 9.6 1 12c6 10 16 10 20 3.4M9.9 9.9a3 3 0 0 0 4.2 4.2",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 16h12l1-16M10 10v8M14 10v8",
  edit: "M14 5l5 5M3 21l5-1L22 6l-5-5L3 15z",
  arrow: "M3 12h18M15 6l6 6-6 6",
  info: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 11v6M12 7h.01",
  credit: "M2 5h20v15H2zM2 10h20M6 15h4",
  star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
  refresh: "M21 3v6h-6M3 21v-6h6M4 9a8 8 0 0 1 13-5l4 5M3 15l4 5a8 8 0 0 0 13-5",
  baby: "M21 13a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 4c5 0 4-5 0-3M8 12h.01M16 12h.01M8 16c2 3 6 3 8 0",
  appliance:
    "M4 2h16v20H4zM4 6h16M9 4h.01M16 4h.01M17 14a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  className = "",
  ...props
}: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`icon ${className}`}
      width="1em"
      height="1em"
      stroke="currentColor"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}
