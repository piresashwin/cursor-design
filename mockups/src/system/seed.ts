export type ColorToken = {
  role: string;
  name: string;
  value: string;
  dark: string;
  note: string;
  usage: number;
};

export type SpaceToken = { name: string; value: number };
export type TypeToken = { name: string; sample: string; display?: boolean };

export const pulseColors: ColorToken[] = [
  {
    role: "Background",
    name: "color.bg",
    value: "#0B1F1A",
    dark: "#061410",
    note: "App canvas",
    usage: 2,
  },
  {
    role: "Foreground",
    name: "color.text",
    value: "#E8F5F0",
    dark: "#F3FBF7",
    note: "Primary text",
    usage: 4,
  },
  {
    role: "Accent",
    name: "color.accent",
    value: "#2DD4A8",
    dark: "#5EE4C1",
    note: "CTA · links",
    usage: 2,
  },
  {
    role: "Muted",
    name: "color.muted",
    value: "#7A9E93",
    dark: "#5F7F76",
    note: "Secondary text",
    usage: 3,
  },
  {
    role: "Danger",
    name: "color.danger",
    value: "#F07167",
    dark: "#F48B83",
    note: "Errors",
    usage: 0,
  },
];

export const blankColors: ColorToken[] = pulseColors.map((c) => ({
  ...c,
  usage: 0,
  value: c.role === "Accent" ? "#888888" : c.value,
}));

export const pulseSpace: SpaceToken[] = [
  { name: "space.2", value: 8 },
  { name: "space.4", value: 16 },
  { name: "space.6", value: 24 },
];

export const pulseType: TypeToken[] = [
  { name: "type.display", sample: "Welcome back", display: true },
  { name: "type.body", sample: "Sign in to continue your training plan." },
];

export const usages: Record<string, { node: string; prop: string }[]> = {
  "color.bg": [
    { node: "fr_login", prop: "fill" },
    { node: "fr_dash", prop: "fill" },
  ],
  "color.accent": [
    { node: "bt_submit", prop: "fill" },
    { node: "bt_continue", prop: "fill" },
  ],
  "color.text": [
    { node: "tx_title", prop: "fill" },
    { node: "tx_greet", prop: "fill" },
  ],
};
