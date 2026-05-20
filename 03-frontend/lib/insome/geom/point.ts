import { DEFAULT_EPS, type Point } from "./types";

/** @example add({x:1,y:2}, {x:3,y:4}) // => {x:4, y:6} */
export function add(p: Point, q: Point): Point {
  return { x: p.x + q.x, y: p.y + q.y };
}

/** @example sub({x:3,y:4}, {x:1,y:2}) // => {x:2, y:2} */
export function sub(p: Point, q: Point): Point {
  return { x: p.x - q.x, y: p.y - q.y };
}

/** @example scale({x:2,y:3}, 2) // => {x:4, y:6} */
export function scale(p: Point, k: number): Point {
  return { x: p.x * k, y: p.y * k };
}

/** @example dist({x:0,y:0}, {x:3,y:4}) // => 5 */
export function dist(p: Point, q: Point): number {
  return Math.sqrt(distSq(p, q));
}

/** @example distSq({x:0,y:0}, {x:3,y:4}) // => 25 */
export function distSq(p: Point, q: Point): number {
  const dx = p.x - q.x;
  const dy = p.y - q.y;
  return dx * dx + dy * dy;
}

/** @example dot({x:1,y:0}, {x:0,y:1}) // => 0 */
export function dot(p: Point, q: Point): number {
  return p.x * q.x + p.y * q.y;
}

/** 2D cross product (scalar). @example cross({x:1,y:0}, {x:0,y:1}) // => 1 */
export function cross(p: Point, q: Point): number {
  return p.x * q.y - p.y * q.x;
}

/** @example equals({x:1,y:1}, {x:1.0000000001,y:1}) // => true */
export function equals(p: Point, q: Point, eps: number = DEFAULT_EPS): boolean {
  return Math.abs(p.x - q.x) <= eps && Math.abs(p.y - q.y) <= eps;
}
