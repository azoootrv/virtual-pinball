export const TABLE_W = 668;
export const TABLE_H = 1024;

export const BALL_R = 11;
export const LEFT = 70;
export const LANE_INNER = 548;
export const LANE_OUTER = 612;
export const PLAY_CENTER = (LEFT + LANE_INNER) / 2;

export const CAT = {
  ball: 0x0001,
  table: 0x0002,
  flipper: 0x0004,
} as const;

export const COLORS = {
  bg: "#050614",
  felt: "#0b1230",
  cyan: "#3dfff8",
  magenta: "#ff2ec8",
  amber: "#ffe14a",
  lime: "#5dff9f",
  wall: "#7af6ff",
  metal: "#d5e4f7",
  drain: "#ff5d7a",
} as const;

export const HIGH_SCORE_KEY = "arc-light-highscore";
export const EXTRA_BALL_AT = 50_000;
export const BALLS_PER_GAME = 3;

export const LANE_LETTERS = ["A", "R", "C"] as const;
