export const TABLE_W = 500;
export const TABLE_H = 900;

export const BALL_R = 11;
export const LEFT = 24;
export const LANE_INNER = 438;
export const LANE_OUTER = 488;
export const PLAY_CENTER = (LEFT + LANE_INNER) / 2;

export const CAT = {
  ball: 0x0001,
  table: 0x0002,
  flipper: 0x0004,
} as const;

export const COLORS = {
  bg: "#07061a",
  felt: "#10143a",
  feltHi: "#1a2260",
  cyan: "#2cf6ff",
  magenta: "#ff3de1",
  amber: "#ffc14a",
  lime: "#5dff9f",
  wall: "#8be9ff",
  metal: "#d5e4f7",
  drain: "#ff5d7a",
} as const;

export const HIGH_SCORE_KEY = "arc-light-highscore";
export const EXTRA_BALL_AT = 50_000;
export const BALLS_PER_GAME = 3;

export const LANE_LETTERS = ["A", "R", "C"] as const;
