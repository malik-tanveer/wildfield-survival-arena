import { describe, expect, it } from "vitest";
import { cameraRelativeMove, fireRound, MAGAZINE_SIZE, reloadMagazine } from "./rules";

describe("combat and movement rules", () => {
  it("uses one round for each shot and cannot fire an empty magazine", () => {
    expect(fireRound(2)).toEqual({ fired: true, ammo: 1 });
    expect(fireRound(0)).toEqual({ fired: false, ammo: 0 });
  });

  it("reloads the rifle to its 30-round magazine capacity", () => {
    expect(reloadMagazine(4)).toBe(MAGAZINE_SIZE);
    expect(MAGAZINE_SIZE).toBe(30);
  });

  it("moves forward with the camera and normalizes diagonal movement", () => {
    expect(cameraRelativeMove(1, 0, 0)).toEqual({ x: 0, z: 1 });
    const diagonal = cameraRelativeMove(1, 1, 0);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1);
  });
});