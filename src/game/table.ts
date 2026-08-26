import Matter from "matter-js";
import { BALL_R, CAT, LANE_INNER, LANE_OUTER, LEFT, PLAY_CENTER, TABLE_H } from "./constants.ts";

const { Bodies, Composite } = Matter;

export type BumperDef = {
  id: number;
  body: Matter.Body;
  color: string;
  flash: number;
};

export type TargetDef = {
  id: number;
  body: Matter.Body;
  hit: boolean;
  flash: number;
};

export type LaneDef = {
  id: number;
  body: Matter.Body;
  letter: string;
  lit: boolean;
};

export type FlipperDef = {
  body: Matter.Body;
  pivot: { x: number; y: number };
  localPivotX: number;
  restAngle: number;
  upAngle: number;
  length: number;
  width: number;
  side: "left" | "right";
};

export type TableParts = {
  walls: Matter.Body[];
  wallChains: { pts: [number, number][]; color: string }[];
  bumpers: BumperDef[];
  targets: TargetDef[];
  lanes: LaneDef[];
  posts: Matter.Body[];
  slings: { id: "left" | "right"; body: Matter.Body; origin: { x: number; y: number }; flash: number }[];
  leftFlipper: FlipperDef;
  rightFlipper: FlipperDef;
  drain: Matter.Body;
  kickZone: Matter.Body;
  gate: Matter.Body;
  launchSpawn: { x: number; y: number };
};

export function wallSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = 16,
  label = "wall",
): Matter.Body {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, len, thickness, {
    isStatic: true,
    angle: Math.atan2(dy, dx),
    restitution: 0.32,
    friction: 0.02,
    label,
    chamfer: { radius: 1 },
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });
}

export function chainWalls(pts: [number, number][], thickness = 16, label = "wall"): Matter.Body[] {
  const bodies: Matter.Body[] = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    bodies.push(wallSegment(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], thickness, label));
  }
  return bodies;
}

function post(x: number, y: number, r = 8, label = "post"): Matter.Body {
  return Bodies.circle(x, y, r, {
    isStatic: true,
    restitution: 0.7,
    friction: 0.02,
    label,
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });
}

function makeFlipper(side: "left" | "right"): FlipperDef {
  const length = 82;
  const width = 16;
  const pivot = side === "left" ? { x: 145, y: 808 } : { x: 317, y: 808 };
  const localPivotX = side === "left" ? -(length / 2 - 7) : length / 2 - 7;
  const restAngle = side === "left" ? 0.5 : -0.5;
  const upAngle = side === "left" ? -0.52 : 0.52;
  const cx = pivot.x - localPivotX * Math.cos(restAngle);
  const cy = pivot.y - localPivotX * Math.sin(restAngle);
  const body = Bodies.rectangle(cx, cy, length, width, {
    angle: restAngle,
    isStatic: true,
    restitution: 0,
    friction: 0.08,
    label: `flipper:${side}`,
    chamfer: { radius: 7 },
    collisionFilter: { category: CAT.flipper, mask: CAT.ball },
  });
  body.friction = 0.08;
  body.restitution = 0;
  return { body, pivot, localPivotX, restAngle, upAngle, length, width, side };
}

export const OUTER_WALL: [number, number][] = [
  [LEFT, 640],
  [LEFT, 188],
  [32, 128],
  [58, 74],
  [102, 38],
  [160, 20],
  [PLAY_CENTER, 14],
  [340, 20],
  [398, 38],
  [442, 74],
  [470, 112],
  [LANE_OUTER, 148],
  [LANE_OUTER, 870],
];

export const LAUNCH_INNER: [number, number][] = [
  [LANE_INNER, 158],
  [LANE_INNER, 870],
];

export const LEFT_OUTLANE: [number, number][] = [
  [LEFT, 640],
  [44, 732],
  [82, 804],
  [122, 850],
];

export const RIGHT_OUTLANE: [number, number][] = [
  [LANE_INNER, 640],
  [418, 732],
  [380, 804],
  [340, 850],
];

export const LEFT_INLANE: [number, number][] = [
  [96, 638],
  [134, 772],
  [145, 804],
];

export const RIGHT_INLANE: [number, number][] = [
  [366, 638],
  [328, 772],
  [317, 804],
];

export function buildTable(world: Matter.Composite): TableParts {
  const wallChains: TableParts["wallChains"] = [
    { pts: OUTER_WALL, color: "#2cf6ff" },
    { pts: LAUNCH_INNER, color: "#ff3de1" },
    { pts: LEFT_OUTLANE, color: "#2cf6ff" },
    { pts: RIGHT_OUTLANE, color: "#2cf6ff" },
    { pts: LEFT_INLANE, color: "#ffc14a" },
    { pts: RIGHT_INLANE, color: "#ffc14a" },
  ];

  const walls = [
    ...chainWalls(OUTER_WALL, 18),
    ...chainWalls(LAUNCH_INNER, 14, "launch-inner"),
    ...chainWalls(LEFT_OUTLANE, 16),
    ...chainWalls(RIGHT_OUTLANE, 16),
    ...chainWalls(LEFT_INLANE, 14),
    ...chainWalls(RIGHT_INLANE, 14),
    wallSegment(LANE_INNER + 2, 8, LANE_OUTER - 2, 8, 18, "lane-roof"),
    wallSegment(LEFT - 8, 8, LANE_INNER - 40, 8, 16, "top-roof"),
    wallSegment(LANE_INNER + 4, 862, LANE_OUTER - 4, 862, 22, "lane-floor"),
  ];

  const bumperSpecs: { x: number; y: number; color: string }[] = [
    { x: 186, y: 278, color: "#ff3de1" },
    { x: 276, y: 278, color: "#2cf6ff" },
    { x: 231, y: 368, color: "#ffc14a" },
  ];

  const bumpers: BumperDef[] = bumperSpecs.map((spec, id) => {
    const body = Bodies.circle(spec.x, spec.y, 28, {
      isStatic: true,
      restitution: 1.15,
      friction: 0,
      label: `bumper:${id}`,
      collisionFilter: { category: CAT.table, mask: CAT.ball },
    });
    return { id, body, color: spec.color, flash: 0 };
  });

  const targets: TargetDef[] = [0, 1, 2].map((id) => {
    const body = Bodies.rectangle(56, 392 + id * 44, 12, 30, {
      isStatic: true,
      angle: 0.18,
      restitution: 0.2,
      label: `target:${id}`,
      collisionFilter: { category: CAT.table, mask: CAT.ball },
    });
    return { id, body, hit: false, flash: 0 };
  });

  const kickTarget = Bodies.rectangle(404, 430, 12, 36, {
    isStatic: true,
    angle: -0.2,
    restitution: 0.2,
    label: "kick-target",
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });
  targets.push({ id: 3, body: kickTarget, hit: false, flash: 0 });

  const laneXs = [170, 231, 292];
  const lanes: LaneDef[] = laneXs.map((x, id) => {
    const body = Bodies.rectangle(x, 92, 44, 36, {
      isStatic: true,
      isSensor: true,
      label: `lane:${id}`,
      collisionFilter: { category: CAT.table, mask: CAT.ball },
    });
    return { id, body, letter: ["A", "R", "C"][id] ?? "A", lit: false };
  });

  const posts = [
    post(140, 88, 7, "lane-post"),
    post(200, 88, 7, "lane-post"),
    post(262, 88, 7, "lane-post"),
    post(322, 88, 7, "lane-post"),
    post(231, 198, 9, "center-post"),
    post(78, 248, 8),
    post(384, 248, 8),
    post(120, 520, 8),
    post(342, 520, 8),
    post(231, 470, 7),
  ];

  const leftSling = Bodies.rectangle(122, 708, 78, 12, {
    isStatic: true,
    angle: 1.12,
    restitution: 1.2,
    friction: 0,
    label: "sling:left",
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });
  const rightSling = Bodies.rectangle(340, 708, 78, 12, {
    isStatic: true,
    angle: -1.12,
    restitution: 1.2,
    friction: 0,
    label: "sling:right",
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });

  const leftFlipper = makeFlipper("left");
  const rightFlipper = makeFlipper("right");

  const drain = Bodies.rectangle(PLAY_CENTER, TABLE_H - 8, 220, 28, {
    isStatic: true,
    isSensor: true,
    label: "drain",
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });

  const kickZone = Bodies.rectangle(78, 828, 50, 46, {
    isStatic: true,
    isSensor: true,
    label: "kickback-zone",
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });

  const gate = Bodies.rectangle(LANE_INNER, 102, 14, 108, {
    isStatic: true,
    label: "gate",
    collisionFilter: { category: CAT.table, mask: 0 },
  });

  const launchSpawn = { x: (LANE_INNER + LANE_OUTER) / 2, y: 820 };

  Composite.add(world, [
    ...walls,
    ...bumpers.map((item) => item.body),
    ...targets.map((item) => item.body),
    ...lanes.map((item) => item.body),
    ...posts,
    leftSling,
    rightSling,
    leftFlipper.body,
    rightFlipper.body,
    drain,
    kickZone,
    gate,
  ]);

  return {
    walls,
    wallChains,
    bumpers,
    targets,
    lanes,
    posts,
    slings: [
      { id: "left", body: leftSling, origin: { x: 100, y: 700 }, flash: 0 },
      { id: "right", body: rightSling, origin: { x: 362, y: 700 }, flash: 0 },
    ],
    leftFlipper,
    rightFlipper,
    drain,
    kickZone,
    gate,
    launchSpawn,
  };
}

export function makeBall(x: number, y: number): Matter.Body {
  return Bodies.circle(x, y, BALL_R, {
    label: "ball",
    restitution: 0.42,
    friction: 0.01,
    frictionAir: 0.0012,
    density: 0.0022,
    slop: 0.01,
    collisionFilter: { category: CAT.ball, mask: CAT.table | CAT.flipper },
  });
}
