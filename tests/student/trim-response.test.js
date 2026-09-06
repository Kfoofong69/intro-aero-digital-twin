import { describe, expect, test } from "vitest";

import {
  pitchingMomentCoefficient,
  trimAngleDegrees,
  disturbanceMomentChange,
  classifyDisturbance,
  isTrimmed,
} from "../../src/student/physics/trim-response.js";

const TOLERANCE = 1e-5;

describe("trim-response physics", () => {
  test("numerical case", () => {
    const cm0 = 0.04;
    const cmAlphaPerRad = -0.8;
    const angleOfAttackDeg = 2.86;
    const disturbanceAlphaDeg = 2.0;

    const cm = pitchingMomentCoefficient(
      cm0,
      cmAlphaPerRad,
      angleOfAttackDeg,
    );

    const alphaTrimDeg = trimAngleDegrees(cm0, cmAlphaPerRad);

    const deltaCm = disturbanceMomentChange(
      cmAlphaPerRad,
      disturbanceAlphaDeg,
    );

    expect(cm).toBeCloseTo(0.00006687, 5);
    expect(alphaTrimDeg).toBeCloseTo(2.8648, 4);
    expect(deltaCm).toBeCloseTo(-0.027925, 5);
    expect(isTrimmed(cm)).toBe(false);
    expect(classifyDisturbance(disturbanceAlphaDeg, deltaCm)).toBe(
      "restoring",
    );
  });

  test("behavioral case doubles disturbance moment change", () => {
    const cmAlphaPerRad = -0.8;

    const deltaCmAt2Deg = disturbanceMomentChange(
      cmAlphaPerRad,
      2.0,
    );

    const deltaCmAt4Deg = disturbanceMomentChange(
      cmAlphaPerRad,
      4.0,
    );

    expect(deltaCmAt4Deg).toBeCloseTo(-0.055851, 5);
    expect(Math.abs(deltaCmAt4Deg)).toBeCloseTo(
      Math.abs(deltaCmAt2Deg) * 2,
      5,
    );
    expect(classifyDisturbance(4.0, deltaCmAt4Deg)).toBe("restoring");
  });

  test("zero slope boundary case does not calculate a trim angle", () => {
    const cm0 = 0.04;
    const cmAlphaPerRad = 0.0;
    const angleOfAttackDeg = 2.86;
    const disturbanceAlphaDeg = 2.0;

    const cm = pitchingMomentCoefficient(
      cm0,
      cmAlphaPerRad,
      angleOfAttackDeg,
    );

    const alphaTrimDeg = trimAngleDegrees(cm0, cmAlphaPerRad);

    const deltaCm = disturbanceMomentChange(
      cmAlphaPerRad,
      disturbanceAlphaDeg,
    );

    expect(cm).toBeCloseTo(0.04, 5);
    expect(alphaTrimDeg).toBe(null);
    expect(deltaCm).toBeCloseTo(0.0, 5);
    expect(classifyDisturbance(disturbanceAlphaDeg, deltaCm)).toBe(
      "neutral",
    );
  });
});
