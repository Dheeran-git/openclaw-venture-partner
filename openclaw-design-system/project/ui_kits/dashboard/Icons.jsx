// Lucide-style inline SVG icons (stroke 1.5, currentColor).
const Ico = ({ d, size = 16, stroke = 1.5, paths }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {paths ? paths.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const Icon = {
  Search:  (p) => <Ico {...p} paths={["m21 21-4.3-4.3", "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z"]} />,
  Inbox:   (p) => <Ico {...p} paths={["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"]} />,
  Send:    (p) => <Ico {...p} paths={["M22 2 11 13", "M22 2 15 22l-4-9-9-4 20-7Z"]} />,
  Users:   (p) => <Ico {...p} paths={["M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M8.5 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"]} />,
  File:    (p) => <Ico {...p} paths={["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"]} />,
  Settings:(p) => <Ico {...p} paths={["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"]} />,
  Templates:(p) => <Ico {...p} paths={["M3 3h18v18H3z", "M9 9h6v6H9z"]} />,
  Check:   (p) => <Ico {...p} d="m5 12 5 5L20 7" />,
  X:       (p) => <Ico {...p} paths={["M18 6 6 18", "m6 6 12 12"]} />,
  ChevR:   (p) => <Ico {...p} d="m9 18 6-6-6-6" />,
  ChevD:   (p) => <Ico {...p} d="m6 9 6 6 6-6" />,
  Up:      (p) => <Ico {...p} d="m6 15 6-6 6 6" />,
  Down:    (p) => <Ico {...p} d="m6 9 6 6 6-6" />,
  Plus:    (p) => <Ico {...p} paths={["M12 5v14", "M5 12h14"]} />,
  Filter:  (p) => <Ico {...p} d="M22 3H2l8 9.46V19l4 2v-8.54Z" />,
  Bell:    (p) => <Ico {...p} paths={["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"]} />,
  Sparkle: (p) => <Ico {...p} paths={["M12 3v3", "M12 18v3", "M3 12h3", "M18 12h3", "m5.6 5.6 2.1 2.1", "m16.3 16.3 2.1 2.1", "m5.6 18.4 2.1-2.1", "m16.3 7.7 2.1-2.1"]} />,
  Clock:   (p) => <Ico {...p} paths={["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 6v6l4 2"]} />,
  Edit:    (p) => <Ico {...p} paths={["M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7", "m18.5 2.5 3 3L12 15l-4 1 1-4Z"]} />,
  Refresh: (p) => <Ico {...p} paths={["M3 12a9 9 0 0 1 15-6.7L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-15 6.7L3 16", "M3 21v-5h5"]} />,
  ExternalLink: (p) => <Ico {...p} paths={["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"]} />,
  Sliders: (p) => <Ico {...p} paths={["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"]} />,
};
window.Icon = Icon;
