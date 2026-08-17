import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF5EC",
        card: "#FFFDF8",
        ink: "#2A211B",
        muted: "#8A7A6C",
        cinnabar: {
          DEFAULT: "#B3402A",
          dark: "#96341F",
          light: "#F6E3DC",
        },
        scallion: {
          DEFAULT: "#52703D",
          dark: "#3F5730",
          light: "#EAF0E3",
        },
        gold: {
          DEFAULT: "#C9962E",
          light: "#F7ECD8",
        },
        line: "#E8DDCB",
      },
      fontFamily: {
        display: [
          '"Songti SC"',
          '"STSong"',
          '"SimSun"',
          '"Noto Serif CJK SC"',
          "serif",
        ],
        body: [
          "-apple-system",
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Noto Sans CJK SC"',
          "sans-serif",
        ],
      },
      boxShadow: {
        menu: "0 1px 2px rgba(42,33,27,0.04), 0 8px 24px -12px rgba(42,33,27,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
