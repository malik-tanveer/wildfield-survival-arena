export const MAGAZINE_SIZE = 30;
export const PLAYER_DAMAGE = 34;
export const SHOT_INTERVAL = 0.14;

export type ShotResult = { fired: boolean; ammo: number };

export function fireRound(ammo: number): ShotResult {
  if (ammo <= 0) return { fired: false, ammo: 0 };
  return { fired: true, ammo: ammo - 1 };
}

export function reloadMagazine(ammo: number, capacity = MAGAZINE_SIZE): number {
  return Math.max(0, Math.floor(capacity));
}

export function cameraRelativeMove(
  forward: number,
  strafe: number,
  yaw: number,
): { x: number; z: number } {
  const length = Math.hypot(forward, strafe);
  const scale = length > 1 ? 1 / length : 1;
  return {
    x: (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * scale,
    z: (Math.cos(yaw) * forward + Math.sin(yaw) * strafe) * scale,
  };
}