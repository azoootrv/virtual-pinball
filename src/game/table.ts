import Matter from "matter-js";
import {
  BALL_R,
  CAT,
  LANE_INNER,
  LANE_OUTER,
  LEFT,
  PLAY_CENTER,
  TABLE_H,
} from "./constants.ts";

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

export type SaucerDef = {
  body: Matter.Body;
  flash: number;
};

export type TableParts = {
  walls: Matter.Body[];
  wallChains: { pts: [number, number][]; color: string }[];
  bumpers: BumperDef[];
  targets: TargetDef[];
  lanes: LaneDef[];
  posts: Matter.Body[];
  slings: { id: "left" | "right"; body: Matter.Body; origin: { x: number; y: number }; flash: number }[];
  saucer: SaucerDef;
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
  const length = 102;
  const width = 26;
  const pivot = side === "left" ? { x: 214, y: 952 } : { x: 416, y: 952 };
  const localPivotX = side === "left" ? -(length / 2 - 13) : length / 2 - 13;
  const restAngle = side === "left" ? 0.46 : -0.46;
  const upAngle = side === "left" ? -0.62 : 0.62;
  const cx = pivot.x - localPivotX * Math.cos(restAngle);
  const cy = pivot.y - localPivotX * Math.sin(restAngle);
  const body = Bodies.rectangle(cx, cy, length, width, {
    angle: restAngle,
    isStatic: true,
    isSensor: true,
    restitution: 0,
    friction: 0.18,
    slop: 0,
    label: `flipper:${side}`,
    collisionFilter: { category: CAT.flipper, mask: CAT.ball },
  });
  body.friction = 0.18;
  body.restitution = 0;
  return { body, pivot, localPivotX, restAngle, upAngle, length, width, side };
}

export const OUTER_WALL: [number, number][] = [
  [LEFT, 720],
  [LEFT, 250],
  [78, 200],
  [120, 168],
  [190, 154],
  [PLAY_CENTER, 148],
  [430, 154],
  [500, 156],
  [548, 168],
  [580, 188],
  [LANE_OUTER, 240],
  [LANE_OUTER, 960],
];

export const LAUNCH_INNER: [number, number][] = [
  [LANE_INNER, 360],
  [LANE_INNER, 960],
];

export const LEFT_OUTLANE: [number, number][] = [
  [LEFT, 720],
  [90, 830],
  [148, 930],
  [188, 1000],
];

export const RIGHT_OUTLANE: [number, number][] = [
  [LANE_INNER, 720],
  [528, 830],
  [470, 930],
  [430, 1000],
];

export const LEFT_INLANE: [number, number][] = [
  [150, 760],
  [188, 890],
  [214, 952],
];

export const RIGHT_INLANE: [number, number][] = [
  [468, 760],
  [430, 890],
  [416, 952],
];

export function buildTable(world: Matter.Composite): TableParts {
  const wallChains: TableParts["wallChains"] = [
    { pts: OUTER_WALL, color: "#3dfff8" },
    { pts: LAUNCH_INNER, color: "#ff2ec8" },
    { pts: LEFT_OUTLANE, color: "#3dfff8" },
    { pts: RIGHT_OUTLANE, color: "#3dfff8" },
    { pts: LEFT_INLANE, color: "#3dfff8" },
    { pts: RIGHT_INLANE, color: "#3dfff8" },
  ];

  const walls = [
    ...chainWalls(OUTER_WALL, 18),
    ...chainWalls(LAUNCH_INNER, 12, "launch-inner"),
    ...chainWalls(LEFT_OUTLANE, 16),
    ...chainWalls(RIGHT_OUTLANE, 16),
    ...chainWalls(LEFT_INLANE, 14),
    ...chainWalls(RIGHT_INLANE, 14),
    wallSegment(LEFT - 6, 132, 530, 132, 16, "top-roof"),
    wallSegment(LANE_INNER + 4, 958, LANE_OUTER - 4, 958, 22, "lane-floor"),
  ];

  const bumperSpecs: { x: number; y: number; color: string }[] = [
    { x: 268, y: 398, color: "#ff2ec8" },
    { x: 388, y: 398, color: "#3dfff8" },
    { x: 328, y: 508, color: "#ffe14a" },
  ];

  const bumpers: BumperDef[] = bumperSpecs.map((spec, id) => {
    const body = Bodies.circle(spec.x, spec.y, 40, {
      isStatic: true,
      restitution: 1.15,
      friction: 0,
      label: `bumper:${id}`,
      collisionFilter: { category: CAT.table, mask: CAT.ball },
    });
    return { id, body, color: spec.color, flash: 0 };
  });

  const targets: TargetDef[] = [0, 1, 2].map((id) => {
    const body = Bodies.rectangle(98, 538 + id * 42, 12, 28, {
      isStatic: true,
      angle: 0.12,
      restitution: 0.2,
      label: `target:${id}`,
      collisionFilter: { category: CAT.table, mask: CAT.ball },
    });
    return { id, body, hit: false, flash: 0 };
  });

  [0, 1, 2].forEach((id) => {
    const body = Bodies.rectangle(520, 538 + id * 42, 12, 28, {
      isStatic: true,
      angle: -0.12,
      restitution: 0.2,
      label: id === 0 ? "kick-target" : `target:${id + 3}`,
      collisionFilter: { category: CAT.table, mask: CAT.ball },
    });
    targets.push({ id: id + 3, body, hit: false, flash: 0 });
  });

  const laneXs = [256, 328, 400];
  const lanes: LaneDef[] = laneXs.map((x, id) => {
    const body = Bodies.rectangle(x, 206, 52, 40, {
      isStatic: true,
      isSensor: true,
      label: `lane:${id}`,
      collisionFilter: { category: CAT.table, mask: CAT.ball },
    });
    return { id, body, letter: ["A", "R", "C"][id] ?? "A", lit: false };
  });

  const saucerBody = Bodies.circle(468, 248, 26, {
    isStatic: true,
    restitution: 1.2,
    friction: 0,
    label: "saucer",
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });

  const posts = [
    post(220, 206, 7, "lane-post"),
    post(292, 206, 7, "lane-post"),
    post(364, 206, 7, "lane-post"),
    post(436, 206, 7, "lane-post"),
    post(328, 318, 8, "center-post"),
    post(150, 330, 7),
    post(118, 470, 7),
    post(500, 470, 7),
    post(328, 620, 7),
  ];

  const leftSling = Bodies.rectangle(176, 838, 82, 14, {
    isStatic: true,
    angle: 1.08,
    restitution: 1.2,
    friction: 0,
    label: "sling:left",
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });
  const rightSling = Bodies.rectangle(442, 838, 82, 14, {
    isStatic: true,
    angle: -1.08,
    restitution: 1.2,
    friction: 0,
    label: "sling:right",
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });

  const leftFlipper = makeFlipper("left");
  const rightFlipper = makeFlipper("right");

  const drain = Bodies.rectangle(PLAY_CENTER, TABLE_H - 10, 250, 28, {
    isStatic: true,
    isSensor: true,
    label: "drain",
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });

  const kickZone = Bodies.rectangle(120, 940, 54, 48, {
    isStatic: true,
    isSensor: true,
    label: "kickback-zone",
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });

  const gate = Bodies.rectangle(LANE_INNER, 328, 14, 72, {
    isStatic: true,
    label: "gate",
    collisionFilter: { category: CAT.table, mask: 0 },
  });

  const launchTurn = Bodies.rectangle((LANE_INNER + LANE_OUTER) / 2, 300, 56, 50, {
    isStatic: true,
    isSensor: true,
    label: "launch-turn",
    collisionFilter: { category: CAT.table, mask: CAT.ball },
  });

  const launchSpawn = { x: (LANE_INNER + LANE_OUTER) / 2, y: 910 };

  Composite.add(world, [
    ...walls,
    ...bumpers.map((item) => item.body),
    ...targets.map((item) => item.body),
    ...lanes.map((item) => item.body),
    saucerBody,
    ...posts,
    leftSling,
    rightSling,
    leftFlipper.body,
    rightFlipper.body,
    drain,
    kickZone,
    gate,
    launchTurn,
  ]);

  return {
    walls,
    wallChains,
    bumpers,
    targets,
    lanes,
    posts,
    slings: [
      { id: "left", body: leftSling, origin: { x: 150, y: 828 }, flash: 0 },
      { id: "right", body: rightSling, origin: { x: 468, y: 828 }, flash: 0 },
    ],
    saucer: { body: saucerBody, flash: 0 },
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
