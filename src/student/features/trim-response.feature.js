import {
  pitchingMomentCoefficient,
  trimAngleDegrees,
  disturbanceMomentChange,
  classifyDisturbance,
  isTrimmed,
} from "../physics/trim-response.js";

const NUMERICAL_TOLERANCE = 1e-5;

function assertAircraftInputs(aircraft) {
  if (!aircraft || typeof aircraft !== "object") {
    throw new TypeError("aircraft must be an object");
  }

  for (const key of [
    "cm0",
    "cmAlphaPerRad",
    "angleOfAttackDeg",
    "disturbanceAlphaDeg",
  ]) {
    if (
      typeof aircraft[key] !== "number" ||
      !Number.isFinite(aircraft[key])
    ) {
      throw new TypeError(`${key} must be a finite number`);
    }
  }
}

function capabilityAvailable(capabilityContext) {
  if (!capabilityContext) {
    return false;
  }

  const requiredId = "loads.pitch.component-sum";
  const requiredVersion = 1;

  const capabilities =
    capabilityContext.capabilities ?? capabilityContext;

  if (Array.isArray(capabilities)) {
    return capabilities.some(
      (capability) =>
        capability?.id === requiredId &&
        Number(capability?.version) >= requiredVersion,
    );
  }

  if (capabilities && typeof capabilities === "object") {
    const capability = capabilities[requiredId];

    if (typeof capability === "number") {
      return capability >= requiredVersion;
    }

    if (capability && typeof capability === "object") {
      return Number(capability.version) >= requiredVersion;
    }
  }

  return false;
}

function approximatelyEqual(actual, expected, tolerance = NUMERICAL_TOLERANCE) {
  return (
    Number.isFinite(actual) &&
    Number.isFinite(expected) &&
    Math.abs(actual - expected) <= tolerance
  );
}

function calculateAnalysis(aircraft) {
  assertAircraftInputs(aircraft);

  const cm = pitchingMomentCoefficient(
    aircraft.cm0,
    aircraft.cmAlphaPerRad,
    aircraft.angleOfAttackDeg,
  );

  const alphaTrimDeg = trimAngleDegrees(
    aircraft.cm0,
    aircraft.cmAlphaPerRad,
  );

  const deltaCm = disturbanceMomentChange(
    aircraft.cmAlphaPerRad,
    aircraft.disturbanceAlphaDeg,
  );

  const tendency = classifyDisturbance(
    aircraft.disturbanceAlphaDeg,
    deltaCm,
  );

  return {
    cm,
    alphaTrimDeg,
    deltaCm,
    trimmed: isTrimmed(cm),
    tendency,
  };
}

function buildPlot(aircraft) {
  const startDeg = -10;
  const endDeg = 10;
  const stepDeg = 1;

  const angles = [];

  for (let angle = startDeg; angle <= endDeg; angle += stepDeg) {
    angles.push(angle);
  }

  if (
    aircraft.angleOfAttackDeg >= startDeg &&
    aircraft.angleOfAttackDeg <= endDeg &&
    !angles.some((angle) => angle === aircraft.angleOfAttackDeg)
  ) {
    angles.push(aircraft.angleOfAttackDeg);
  }

  angles.sort((a, b) => a - b);

  return {
    title: "Cm–alpha relationship",
    xAxis: {
      label: "Angle of attack",
      unit: "deg",
    },
    yAxis: {
      label: "Pitching-moment coefficient",
      unit: "",
    },
    series: [
      {
        name: "Cm(alpha)",
        points: angles.map((angleOfAttackDeg) => ({
          x: angleOfAttackDeg,
          y: pitchingMomentCoefficient(
            aircraft.cm0,
            aircraft.cmAlphaPerRad,
            angleOfAttackDeg,
          ),
        })),
      },
    ],
    regions: [],
    referenceLines: [
      {
        value: 0,
        label: "Cm = 0",
      },
    ],
  };
}

function buildVerificationCases() {
  const numericalAircraft = {
    cm0: 0.04,
    cmAlphaPerRad: -0.8,
    angleOfAttackDeg: 2.86,
    disturbanceAlphaDeg: 2.0,
  };

  const numerical = calculateAnalysis(numericalAircraft);

  const behavioralAircraft = {
    ...numericalAircraft,
    disturbanceAlphaDeg: 4.0,
  };

  const behavioral = calculateAnalysis(behavioralAircraft);

  const boundaryAircraft = {
    cm0: 0.04,
    cmAlphaPerRad: 0,
    angleOfAttackDeg: 2.86,
    disturbanceAlphaDeg: 2.0,
  };

  const boundary = calculateAnalysis(boundaryAircraft);

  return [
    {
      id: "numerical",
      title: "Numerical case",
      inputs: numericalAircraft,
      expected: {
        cm: 0.00006687,
        alphaTrimDeg: 2.8648,
        deltaCm: -0.027925,
        trimmed: false,
        tendency: "restoring",
      },
      passed:
        approximatelyEqual(numerical.cm, 0.00006687) &&
        approximatelyEqual(numerical.alphaTrimDeg, 2.8648) &&
        approximatelyEqual(numerical.deltaCm, -0.027925) &&
        numerical.trimmed === false &&
        numerical.tendency === "restoring",
    },
    {
      id: "behavioral",
      title: "Behavioral case",
      inputs: behavioralAircraft,
      expected: {
        deltaCm: -0.055851,
        tendency: "restoring",
      },
      passed:
        approximatelyEqual(behavioral.deltaCm, -0.055851) &&
        approximatelyEqual(
          Math.abs(behavioral.deltaCm),
          Math.abs(numerical.deltaCm) * 2,
        ) &&
        behavioral.tendency === "restoring",
    },
    {
      id: "zero-slope",
      title: "Boundary/sanity case",
      inputs: boundaryAircraft,
      expected: {
        cm: 0.04,
        alphaTrimDeg: "not available",
        deltaCm: 0,
        tendency: "neutral",
      },
      passed:
        approximatelyEqual(boundary.cm, 0.04) &&
        (boundary.alphaTrimDeg === null || boundary.alphaTrimDeg === "not available") &&
        approximatelyEqual(boundary.deltaCm, 0) &&
        boundary.tendency === "neutral",
    },
  ];
}

export const feature = {
  contractVersion: 4,
  id: "trim-response",
  title: "Live Cm–alpha relationship and trim",
  description:
    "Determines pitch trim and small-disturbance tendency using a linear quasi-static Cm–alpha model.",
  category: "Stability · Student feature",
  learningMode: "concept",
  topicId: "stability",
  inputKeys: [
    "cm0",
    "cmAlphaPerRad",
    "angleOfAttackDeg",
    "disturbanceAlphaDeg",
  ],
  requiresCapabilities: [
    {
      id: "loads.pitch.component-sum",
      version: 1,
    },
  ],
  providesCapabilities: [
    {
      id: "stability.pitch.cm-alpha",
      version: 1,
    },
  ],
  assumptions: [
    "The Cm–alpha relationship is linear over the investigated range.",
    "The model is quasi-static and represents a small disturbance about the selected condition.",
    "Cm0 and Cm_alpha represent the same aircraft configuration and flight condition.",
    "Positive pitching moment and positive angle of attack are nose-up.",
  ],
  validityLimits: [
    "Do not use this linear relationship at stall, at large angle of attack, or where aerodynamic coefficients are strongly nonlinear.",
    "This model does not calculate a time history, damping, control motion, or handling quality.",
    "A restoring tendency in this model is not proof of acceptable safety, controllability, or flightworthiness.",
    "The calculated trim angle is meaningful only when the linear model remains valid at that angle.",
  ],
  simulation: {
    display: "analysis-only",
    durationS: 1,
    initialState: {},
    controls: {},
    disturbance: {},
  },

  analyze(aircraft, capabilityContext) {
    if (!capabilityAvailable(capabilityContext)) {
      return {
        results: [],
        verificationCases: [],
        decision: {
          question:
            "At the selected angle of attack, is the simplified pitching-moment model trimmed, and does a small angle-of-attack disturbance create a restoring moment tendency?",
          interpretation:
            "The required Stage 3 longitudinal moment-contribution capability is not available, so the Stage 4 analysis remains locked.",
          status: "caution",
        },
        plots: [],
        scene: null,
      };
    }

    const analysis = calculateAnalysis(aircraft);

    const results = [
      {
        id: "cm-alpha",
        label: "Cm(alpha)",
        value: analysis.cm,
        unit: "",
        precision: 8,
        emphasis: true,
      },
      {
        id: "trim-angle",
        label: "Trim angle",
        value:
          analysis.alphaTrimDeg === null
            ? "not available"
            : analysis.alphaTrimDeg,
        unit: analysis.alphaTrimDeg === null ? "" : "deg",
        precision: 4,
      },
      {
        id: "delta-cm",
        label: "Delta Cm",
        value: analysis.deltaCm,
        unit: "",
        precision: 6,
      },
      {
        id: "trimmed",
        label: "Selected condition",
        value: analysis.trimmed ? "trimmed" : "not trimmed",
        unit: "",
        precision: 0,
      },
      {
        id: "disturbance-tendency",
        label: "Disturbance tendency",
        value: analysis.tendency,
        unit: "",
        precision: 0,
      },
    ];

    const status = analysis.tendency === "destabilizing" ? "caution" : "pass";

    return {
      results,
      verificationCases: buildVerificationCases(),
      decision: {
        question:
          "At the selected angle of attack, is the simplified pitching-moment model trimmed, and does a small angle-of-attack disturbance create a restoring moment tendency?",
        interpretation: analysis.trimmed
          ? `The selected condition is trimmed under the specified tolerance, and the disturbance has a ${analysis.tendency} tendency under the linear quasi-static model.`
          : `The selected condition is not trimmed under the specified tolerance, and the disturbance has a ${analysis.tendency} tendency under the linear quasi-static model.`,
        status,
      },
      plots: [buildPlot(aircraft)],
      scene: null,
    };
  },
};

export const model = {
  kind: "derived",

  evaluate(runtimeContext) {
    const aircraft = runtimeContext?.aircraft;
    assertAircraftInputs(aircraft);

    const values = calculateAnalysis(aircraft);

    return {
      values: {
        cmAlpha: values.cm,
        trimAngleDeg: values.alphaTrimDeg,
        deltaCm: values.deltaCm,
        trimmed: values.trimmed,
        disturbanceTendency: values.tendency,
      },
    };
  },
};