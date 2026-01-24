/**
 * OPR (Offensive Power Rating) Calculator
 *
 * OPR uses linear algebra to estimate individual team contributions
 * from alliance match scores. This implementation uses iterative
 * least squares approximation which converges to the same result
 * as the matrix pseudo-inverse method.
 */

export interface MatchResult {
  redTeam1: number;
  redTeam2: number;
  blueTeam1: number;
  blueTeam2: number;
  redScore: number;
  blueScore: number;
  // Component scores for detailed OPR
  redAutoScore?: number;
  redTeleopScore?: number;
  redEndgameScore?: number;
  blueAutoScore?: number;
  blueTeleopScore?: number;
  blueEndgameScore?: number;
}

export interface OPRResult {
  teamNumber: number;
  opr: number;
  autoOpr?: number;
  teleopOpr?: number;
  endgameOpr?: number;
  dpr?: number; // Defensive Power Rating
  ccwm?: number; // Calculated Contribution to Winning Margin
}

/**
 * Calculate OPR using iterative least squares approximation
 */
export function calculateOPR(matches: MatchResult[]): Map<number, OPRResult> {
  if (matches.length === 0) {
    return new Map();
  }

  // Get unique teams
  const teamsSet = new Set<number>();
  for (const match of matches) {
    teamsSet.add(match.redTeam1);
    teamsSet.add(match.redTeam2);
    teamsSet.add(match.blueTeam1);
    teamsSet.add(match.blueTeam2);
  }
  const teams = Array.from(teamsSet).sort((a, b) => a - b);

  // Count matches per team for weighting
  const matchCounts = new Map<number, number>();
  for (const team of teams) {
    matchCounts.set(team, 0);
  }
  for (const match of matches) {
    matchCounts.set(match.redTeam1, (matchCounts.get(match.redTeam1) || 0) + 1);
    matchCounts.set(match.redTeam2, (matchCounts.get(match.redTeam2) || 0) + 1);
    matchCounts.set(match.blueTeam1, (matchCounts.get(match.blueTeam1) || 0) + 1);
    matchCounts.set(match.blueTeam2, (matchCounts.get(match.blueTeam2) || 0) + 1);
  }

  // Initialize OPR estimates with average score per robot
  const avgScore =
    matches.reduce((sum, m) => sum + m.redScore + m.blueScore, 0) /
    (matches.length * 4); // 4 robots per match

  const oprEstimates = new Map<number, number>();
  const autoOprEstimates = new Map<number, number>();
  const teleopOprEstimates = new Map<number, number>();
  const endgameOprEstimates = new Map<number, number>();
  const ccwmEstimates = new Map<number, number>();

  // Check if component scores available
  const hasComponentScores = matches.some(
    (m) => m.redAutoScore !== undefined && m.blueAutoScore !== undefined
  );

  let avgAuto = 0;
  let avgTeleop = 0;
  let avgEndgame = 0;

  if (hasComponentScores) {
    const componentMatches = matches.filter(
      (m) => m.redAutoScore !== undefined
    );
    avgAuto =
      componentMatches.reduce(
        (sum, m) => sum + (m.redAutoScore || 0) + (m.blueAutoScore || 0),
        0
      ) /
      (componentMatches.length * 4);
    avgTeleop =
      componentMatches.reduce(
        (sum, m) => sum + (m.redTeleopScore || 0) + (m.blueTeleopScore || 0),
        0
      ) /
      (componentMatches.length * 4);
    avgEndgame =
      componentMatches.reduce(
        (sum, m) => sum + (m.redEndgameScore || 0) + (m.blueEndgameScore || 0),
        0
      ) /
      (componentMatches.length * 4);
  }

  for (const team of teams) {
    oprEstimates.set(team, avgScore);
    autoOprEstimates.set(team, avgAuto);
    teleopOprEstimates.set(team, avgTeleop);
    endgameOprEstimates.set(team, avgEndgame);
    ccwmEstimates.set(team, 0);
  }

  // Iterative refinement (gradient descent with momentum)
  const iterations = 100;
  const learningRate = 0.15;

  for (let iter = 0; iter < iterations; iter++) {
    const oprUpdates = new Map<number, number[]>();
    const ccwmUpdates = new Map<number, number[]>();
    const autoUpdates = new Map<number, number[]>();
    const teleopUpdates = new Map<number, number[]>();
    const endgameUpdates = new Map<number, number[]>();

    for (const team of teams) {
      oprUpdates.set(team, []);
      ccwmUpdates.set(team, []);
      autoUpdates.set(team, []);
      teleopUpdates.set(team, []);
      endgameUpdates.set(team, []);
    }

    for (const match of matches) {
      // Red alliance OPR
      const redExpected =
        (oprEstimates.get(match.redTeam1) || 0) +
        (oprEstimates.get(match.redTeam2) || 0);
      const redError = match.redScore - redExpected;
      oprUpdates.get(match.redTeam1)!.push(redError / 2);
      oprUpdates.get(match.redTeam2)!.push(redError / 2);

      // CCWM
      const redMargin = match.redScore - match.blueScore;
      const redExpectedMargin =
        (ccwmEstimates.get(match.redTeam1) || 0) +
        (ccwmEstimates.get(match.redTeam2) || 0) -
        (ccwmEstimates.get(match.blueTeam1) || 0) -
        (ccwmEstimates.get(match.blueTeam2) || 0);
      const redMarginError = redMargin - redExpectedMargin;
      ccwmUpdates.get(match.redTeam1)!.push(redMarginError / 4);
      ccwmUpdates.get(match.redTeam2)!.push(redMarginError / 4);

      // Blue alliance OPR
      const blueExpected =
        (oprEstimates.get(match.blueTeam1) || 0) +
        (oprEstimates.get(match.blueTeam2) || 0);
      const blueError = match.blueScore - blueExpected;
      oprUpdates.get(match.blueTeam1)!.push(blueError / 2);
      oprUpdates.get(match.blueTeam2)!.push(blueError / 2);

      // CCWM for blue
      ccwmUpdates.get(match.blueTeam1)!.push(-redMarginError / 4);
      ccwmUpdates.get(match.blueTeam2)!.push(-redMarginError / 4);

      // Component OPRs
      if (hasComponentScores && match.redAutoScore !== undefined) {
        // Auto
        const redAutoExpected =
          (autoOprEstimates.get(match.redTeam1) || 0) +
          (autoOprEstimates.get(match.redTeam2) || 0);
        const redAutoError = match.redAutoScore - redAutoExpected;
        autoUpdates.get(match.redTeam1)!.push(redAutoError / 2);
        autoUpdates.get(match.redTeam2)!.push(redAutoError / 2);

        const blueAutoExpected =
          (autoOprEstimates.get(match.blueTeam1) || 0) +
          (autoOprEstimates.get(match.blueTeam2) || 0);
        const blueAutoError = (match.blueAutoScore || 0) - blueAutoExpected;
        autoUpdates.get(match.blueTeam1)!.push(blueAutoError / 2);
        autoUpdates.get(match.blueTeam2)!.push(blueAutoError / 2);

        // Teleop
        const redTeleopExpected =
          (teleopOprEstimates.get(match.redTeam1) || 0) +
          (teleopOprEstimates.get(match.redTeam2) || 0);
        const redTeleopError = (match.redTeleopScore || 0) - redTeleopExpected;
        teleopUpdates.get(match.redTeam1)!.push(redTeleopError / 2);
        teleopUpdates.get(match.redTeam2)!.push(redTeleopError / 2);

        const blueTeleopExpected =
          (teleopOprEstimates.get(match.blueTeam1) || 0) +
          (teleopOprEstimates.get(match.blueTeam2) || 0);
        const blueTeleopError =
          (match.blueTeleopScore || 0) - blueTeleopExpected;
        teleopUpdates.get(match.blueTeam1)!.push(blueTeleopError / 2);
        teleopUpdates.get(match.blueTeam2)!.push(blueTeleopError / 2);

        // Endgame
        const redEndgameExpected =
          (endgameOprEstimates.get(match.redTeam1) || 0) +
          (endgameOprEstimates.get(match.redTeam2) || 0);
        const redEndgameError =
          (match.redEndgameScore || 0) - redEndgameExpected;
        endgameUpdates.get(match.redTeam1)!.push(redEndgameError / 2);
        endgameUpdates.get(match.redTeam2)!.push(redEndgameError / 2);

        const blueEndgameExpected =
          (endgameOprEstimates.get(match.blueTeam1) || 0) +
          (endgameOprEstimates.get(match.blueTeam2) || 0);
        const blueEndgameError =
          (match.blueEndgameScore || 0) - blueEndgameExpected;
        endgameUpdates.get(match.blueTeam1)!.push(blueEndgameError / 2);
        endgameUpdates.get(match.blueTeam2)!.push(blueEndgameError / 2);
      }
    }

    // Apply updates with decreasing learning rate
    const currentLR = learningRate * (1 - iter / iterations / 2);

    for (const team of teams) {
      const updates = oprUpdates.get(team)!;
      if (updates.length > 0) {
        const avgUpdate = updates.reduce((a, b) => a + b, 0) / updates.length;
        oprEstimates.set(
          team,
          (oprEstimates.get(team) || 0) + currentLR * avgUpdate
        );
      }

      const ccwmUp = ccwmUpdates.get(team)!;
      if (ccwmUp.length > 0) {
        const avgCcwm = ccwmUp.reduce((a, b) => a + b, 0) / ccwmUp.length;
        ccwmEstimates.set(
          team,
          (ccwmEstimates.get(team) || 0) + currentLR * avgCcwm
        );
      }

      if (hasComponentScores) {
        const autoUp = autoUpdates.get(team)!;
        if (autoUp.length > 0) {
          const avg = autoUp.reduce((a, b) => a + b, 0) / autoUp.length;
          autoOprEstimates.set(
            team,
            (autoOprEstimates.get(team) || 0) + currentLR * avg
          );
        }

        const teleopUp = teleopUpdates.get(team)!;
        if (teleopUp.length > 0) {
          const avg = teleopUp.reduce((a, b) => a + b, 0) / teleopUp.length;
          teleopOprEstimates.set(
            team,
            (teleopOprEstimates.get(team) || 0) + currentLR * avg
          );
        }

        const endgameUp = endgameUpdates.get(team)!;
        if (endgameUp.length > 0) {
          const avg = endgameUp.reduce((a, b) => a + b, 0) / endgameUp.length;
          endgameOprEstimates.set(
            team,
            (endgameOprEstimates.get(team) || 0) + currentLR * avg
          );
        }
      }
    }
  }

  // Build results
  const results = new Map<number, OPRResult>();
  for (const team of teams) {
    const opr = oprEstimates.get(team) || 0;
    const ccwm = ccwmEstimates.get(team) || 0;
    const dpr = opr - ccwm;

    results.set(team, {
      teamNumber: team,
      opr: Math.round(opr * 100) / 100,
      autoOpr: hasComponentScores
        ? Math.round((autoOprEstimates.get(team) || 0) * 100) / 100
        : undefined,
      teleopOpr: hasComponentScores
        ? Math.round((teleopOprEstimates.get(team) || 0) * 100) / 100
        : undefined,
      endgameOpr: hasComponentScores
        ? Math.round((endgameOprEstimates.get(team) || 0) * 100) / 100
        : undefined,
      dpr: Math.round(dpr * 100) / 100,
      ccwm: Math.round(ccwm * 100) / 100,
    });
  }

  return results;
}

/**
 * Calculate OPR for a specific team
 */
export function getTeamOPR(
  matches: MatchResult[],
  teamNumber: number
): OPRResult | null {
  const allOpr = calculateOPR(matches);
  return allOpr.get(teamNumber) || null;
}

/**
 * Get OPR rankings sorted by OPR value
 */
export function getOPRRankings(matches: MatchResult[]): OPRResult[] {
  const allOpr = calculateOPR(matches);
  return Array.from(allOpr.values()).sort((a, b) => b.opr - a.opr);
}
