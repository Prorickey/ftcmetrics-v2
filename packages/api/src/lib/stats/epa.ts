/**
 * EPA (Expected Points Added) Calculator
 *
 * Based on Statbotics methodology:
 * - EPA represents how many points above/below average a team contributes
 * - Starts with a prior estimate (baseline average)
 * - Updates incrementally after each match using Bayesian-style updates
 *
 * EPA for a team = (Actual Score - Expected Score) contribution
 *
 * Reference: https://www.statbotics.io/blog/epa
 */

// DECODE 2025-2026 baseline scores (estimated from early season)
const DECODE_BASELINE = {
  autoScore: 8, // Average auto score per alliance
  teleopScore: 25, // Average teleop score per alliance
  endgameScore: 5, // Average endgame score per alliance
  totalScore: 38, // Average total score per alliance
};

// Per-robot baseline (divide alliance by 2)
const PER_ROBOT_BASELINE = {
  autoScore: DECODE_BASELINE.autoScore / 2,
  teleopScore: DECODE_BASELINE.teleopScore / 2,
  endgameScore: DECODE_BASELINE.endgameScore / 2,
  totalScore: DECODE_BASELINE.totalScore / 2,
};

// Learning rate for EPA updates
const K_FACTOR = 0.2;

export interface MatchForEPA {
  matchNumber: number;
  redTeam1: number;
  redTeam2: number;
  blueTeam1: number;
  blueTeam2: number;
  redScore: number;
  blueScore: number;
  redAutoScore?: number;
  redTeleopScore?: number;
  redEndgameScore?: number;
  blueAutoScore?: number;
  blueTeleopScore?: number;
  blueEndgameScore?: number;
}

export interface EPAResult {
  teamNumber: number;
  epa: number;
  autoEpa: number;
  teleopEpa: number;
  endgameEpa: number;
  matchCount: number;
  recentEpa?: number; // Last 5 matches
  trend?: "up" | "down" | "stable";
}

interface TeamEPAState {
  totalEpa: number;
  autoEpa: number;
  teleopEpa: number;
  endgameEpa: number;
  matchCount: number;
  recentEpas: number[]; // Store last 5 EPAs for trend
}

/**
 * Calculate dynamic baselines from match data
 */
function calculateBaselines(matches: MatchForEPA[]): {
  totalScore: number;
  autoScore: number;
  teleopScore: number;
  endgameScore: number;
} {
  if (matches.length === 0) {
    return {
      totalScore: DECODE_BASELINE.totalScore,
      autoScore: DECODE_BASELINE.autoScore,
      teleopScore: DECODE_BASELINE.teleopScore,
      endgameScore: DECODE_BASELINE.endgameScore,
    };
  }

  // Calculate average alliance scores from match data
  let totalSum = 0;
  let autoSum = 0;
  let teleopSum = 0;
  let endgameSum = 0;
  let scoreCount = 0;
  let componentCount = 0;

  for (const match of matches) {
    totalSum += match.redScore + match.blueScore;
    scoreCount += 2; // 2 alliances

    if (match.redAutoScore !== undefined) {
      autoSum += (match.redAutoScore || 0) + (match.blueAutoScore || 0);
      teleopSum += (match.redTeleopScore || 0) + (match.blueTeleopScore || 0);
      endgameSum += (match.redEndgameScore || 0) + (match.blueEndgameScore || 0);
      componentCount += 2;
    }
  }

  const avgTotal = scoreCount > 0 ? totalSum / scoreCount : DECODE_BASELINE.totalScore;
  const avgAuto = componentCount > 0 ? autoSum / componentCount : DECODE_BASELINE.autoScore;
  const avgTeleop = componentCount > 0 ? teleopSum / componentCount : DECODE_BASELINE.teleopScore;
  const avgEndgame = componentCount > 0 ? endgameSum / componentCount : DECODE_BASELINE.endgameScore;

  return {
    totalScore: avgTotal,
    autoScore: avgAuto,
    teleopScore: avgTeleop,
    endgameScore: avgEndgame,
  };
}

/**
 * Calculate adaptive K-factor based on match count
 * Higher K for early matches, lower K as data accumulates
 */
function getAdaptiveKFactor(matchCount: number): number {
  // K starts at 0.4 for new teams and decreases to 0.1 for experienced teams
  const minK = 0.1;
  const maxK = 0.4;
  const decayRate = 0.1;

  return Math.max(minK, maxK * Math.exp(-decayRate * matchCount));
}

/**
 * Calculate EPA for all teams from chronologically ordered match results
 */
export function calculateEPA(matches: MatchForEPA[]): Map<number, EPAResult> {
  // Sort matches by match number to ensure chronological order
  const sortedMatches = [...matches].sort(
    (a, b) => a.matchNumber - b.matchNumber
  );

  // Calculate dynamic baselines from actual match data
  const baselines = calculateBaselines(sortedMatches);
  const perRobotBaseline = {
    totalScore: baselines.totalScore / 2,
    autoScore: baselines.autoScore / 2,
    teleopScore: baselines.teleopScore / 2,
    endgameScore: baselines.endgameScore / 2,
  };

  // Initialize team EPA states
  const teamStates = new Map<number, TeamEPAState>();

  const initializeTeam = (teamNumber: number) => {
    if (!teamStates.has(teamNumber)) {
      teamStates.set(teamNumber, {
        totalEpa: 0,
        autoEpa: 0,
        teleopEpa: 0,
        endgameEpa: 0,
        matchCount: 0,
        recentEpas: [],
      });
    }
  };

  // Process each match
  for (const match of sortedMatches) {
    // Initialize all teams in this match
    initializeTeam(match.redTeam1);
    initializeTeam(match.redTeam2);
    initializeTeam(match.blueTeam1);
    initializeTeam(match.blueTeam2);

    // Get current EPAs
    const red1 = teamStates.get(match.redTeam1)!;
    const red2 = teamStates.get(match.redTeam2)!;
    const blue1 = teamStates.get(match.blueTeam1)!;
    const blue2 = teamStates.get(match.blueTeam2)!;

    // Calculate expected scores using dynamic baselines
    const expectedRedScore =
      baselines.totalScore +
      (red1.totalEpa + red2.totalEpa) -
      (blue1.totalEpa + blue2.totalEpa) / 2;
    const expectedBlueScore =
      baselines.totalScore +
      (blue1.totalEpa + blue2.totalEpa) -
      (red1.totalEpa + red2.totalEpa) / 2;

    // Calculate score deltas (actual - expected)
    const redDelta = match.redScore - expectedRedScore;
    const blueDelta = match.blueScore - expectedBlueScore;

    // Update EPA for each team
    // Each team gets half the alliance delta
    const updateTeam = (
      state: TeamEPAState,
      delta: number,
      autoScore: number | undefined,
      teleopScore: number | undefined,
      endgameScore: number | undefined
    ) => {
      const teamDelta = delta / 2;
      // Use adaptive K-factor based on team's match experience
      const kFactor = getAdaptiveKFactor(state.matchCount);
      state.totalEpa += kFactor * teamDelta;

      // Component EPA updates if available (using dynamic baselines)
      if (autoScore !== undefined) {
        const expectedAuto = perRobotBaseline.autoScore + state.autoEpa;
        const autoDelta = autoScore / 2 - expectedAuto;
        state.autoEpa += kFactor * autoDelta;
      }

      if (teleopScore !== undefined) {
        const expectedTeleop = perRobotBaseline.teleopScore + state.teleopEpa;
        const teleopDelta = teleopScore / 2 - expectedTeleop;
        state.teleopEpa += kFactor * teleopDelta;
      }

      if (endgameScore !== undefined) {
        const expectedEndgame = perRobotBaseline.endgameScore + state.endgameEpa;
        const endgameDelta = endgameScore / 2 - expectedEndgame;
        state.endgameEpa += kFactor * endgameDelta;
      }

      state.matchCount++;
      state.recentEpas.push(state.totalEpa);
      if (state.recentEpas.length > 5) {
        state.recentEpas.shift();
      }
    };

    updateTeam(
      red1,
      redDelta,
      match.redAutoScore,
      match.redTeleopScore,
      match.redEndgameScore
    );
    updateTeam(
      red2,
      redDelta,
      match.redAutoScore,
      match.redTeleopScore,
      match.redEndgameScore
    );
    updateTeam(
      blue1,
      blueDelta,
      match.blueAutoScore,
      match.blueTeleopScore,
      match.blueEndgameScore
    );
    updateTeam(
      blue2,
      blueDelta,
      match.blueAutoScore,
      match.blueTeleopScore,
      match.blueEndgameScore
    );
  }

  // Build results
  const results = new Map<number, EPAResult>();

  for (const [teamNumber, state] of teamStates) {
    // Calculate trend
    let trend: "up" | "down" | "stable" = "stable";
    if (state.recentEpas.length >= 3) {
      const recent = state.recentEpas.slice(-3);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const first = recent[0];
      if (avg > first + 0.5) trend = "up";
      else if (avg < first - 0.5) trend = "down";
    }

    results.set(teamNumber, {
      teamNumber,
      epa: Math.round(state.totalEpa * 100) / 100,
      autoEpa: Math.round(state.autoEpa * 100) / 100,
      teleopEpa: Math.round(state.teleopEpa * 100) / 100,
      endgameEpa: Math.round(state.endgameEpa * 100) / 100,
      matchCount: state.matchCount,
      recentEpa:
        state.recentEpas.length > 0
          ? Math.round(
              (state.recentEpas.reduce((a, b) => a + b, 0) /
                state.recentEpas.length) *
                100
            ) / 100
          : undefined,
      trend,
    });
  }

  return results;
}

/**
 * Get EPA for a specific team
 */
export function getTeamEPA(
  matches: MatchForEPA[],
  teamNumber: number
): EPAResult | null {
  const allEpa = calculateEPA(matches);
  return allEpa.get(teamNumber) || null;
}

/**
 * Get EPA rankings sorted by EPA value
 */
export function getEPARankings(matches: MatchForEPA[]): EPAResult[] {
  const allEpa = calculateEPA(matches);
  return Array.from(allEpa.values()).sort((a, b) => b.epa - a.epa);
}

/**
 * Predict match outcome based on EPA
 */
export function predictMatch(
  teamEpas: Map<number, EPAResult>,
  redTeam1: number,
  redTeam2: number,
  blueTeam1: number,
  blueTeam2: number,
  baselineScore?: number
): {
  predictedRedScore: number;
  predictedBlueScore: number;
  redWinProbability: number;
} {
  const red1Epa = teamEpas.get(redTeam1)?.epa || 0;
  const red2Epa = teamEpas.get(redTeam2)?.epa || 0;
  const blue1Epa = teamEpas.get(blueTeam1)?.epa || 0;
  const blue2Epa = teamEpas.get(blueTeam2)?.epa || 0;

  // Use provided baseline or fall back to default
  const baseline = baselineScore ?? DECODE_BASELINE.totalScore;
  const redExpected = baseline + red1Epa + red2Epa;
  const blueExpected = baseline + blue1Epa + blue2Epa;

  // Win probability using logistic function
  const scoreDiff = redExpected - blueExpected;
  const redWinProb = 1 / (1 + Math.exp(-scoreDiff / 10));

  return {
    predictedRedScore: Math.round(redExpected),
    predictedBlueScore: Math.round(blueExpected),
    redWinProbability: Math.round(redWinProb * 100) / 100,
  };
}

/**
 * Get calculated baselines from match data
 * Useful for passing to predictMatch for accurate predictions
 */
export function getCalculatedBaseline(matches: MatchForEPA[]): number {
  const baselines = calculateBaselines(matches);
  return baselines.totalScore;
}

/**
 * Update baseline scores (should be called periodically with season data)
 */
export function updateBaseline(
  avgAutoScore: number,
  avgTeleopScore: number,
  avgEndgameScore: number
) {
  DECODE_BASELINE.autoScore = avgAutoScore;
  DECODE_BASELINE.teleopScore = avgTeleopScore;
  DECODE_BASELINE.endgameScore = avgEndgameScore;
  DECODE_BASELINE.totalScore = avgAutoScore + avgTeleopScore + avgEndgameScore;

  // Update per-robot baseline
  PER_ROBOT_BASELINE.autoScore = avgAutoScore / 2;
  PER_ROBOT_BASELINE.teleopScore = avgTeleopScore / 2;
  PER_ROBOT_BASELINE.endgameScore = avgEndgameScore / 2;
  PER_ROBOT_BASELINE.totalScore = DECODE_BASELINE.totalScore / 2;
}
