// SDK Configuration
export interface FTCMetricsConfig {
  /** FTCMetrics API key (starts with ftcm_) */
  ftcmApiKey?: string;
  /** FTC Events API credentials */
  ftcApiCredentials?: { username: string; token: string };
  /** Base URL for FTCMetrics API (default: https://ftcmetrics.com/api) */
  baseUrl?: string;
  /** FTC season year (default: 2025) */
  season?: number;
}

// --- FTC Events API Types ---

export interface FTCEvent {
  code: string;
  name: string;
  districtCode: string | null;
  venue: string;
  address: string;
  city: string;
  stateprov: string;
  country: string;
  dateStart: string;
  dateEnd: string;
  type: string;
  typeName: string;
  timezone: string;
  published: boolean;
}

export interface FTCTeam {
  teamNumber: number;
  nameFull: string;
  nameShort: string;
  city: string;
  stateProv: string;
  country: string;
  rookieYear: number;
  schoolName: string;
  website: string | null;
}

export interface FTCMatch {
  matchNumber: number;
  tournamentLevel: string;
  description: string;
  startTime: string;
  actualStartTime: string | null;
  postResultTime: string | null;
  teams: FTCMatchTeam[];
  modifiedOn: string;
}

export interface FTCMatchTeam {
  teamNumber: number;
  station: string;
  surrogate: boolean;
  dq: boolean;
}

export interface FTCMatchScore {
  matchLevel: string;
  matchNumber: number;
  matchSeries: number;
  alliances: {
    alliance: "Red" | "Blue";
    totalPoints: number;
    autoPoints: number;
    dcPoints: number;
    endgamePoints: number;
    penaltyPointsCommitted: number;
    prePenaltyTotal: number;
    team1: number;
    team2: number;
    [key: string]: unknown;
  }[];
}

export interface FTCRankings {
  Rankings: {
    rank: number;
    teamNumber: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    ties: number;
    qualAverage: number;
    sortOrder1: number;
    sortOrder2: number;
    sortOrder3: number;
    sortOrder4: number;
    sortOrder5: number;
    sortOrder6: number;
  }[];
}

// --- FTCMetrics API Types ---

export interface OPRResult {
  teamNumber: number;
  opr: number;
  autoOpr?: number;
  teleopOpr?: number;
  endgameOpr?: number;
  dpr?: number;
  ccwm?: number;
}

export interface EPAResult {
  teamNumber: number;
  epa: number;
  autoEpa: number;
  teleopEpa: number;
  endgameEpa: number;
  matchCount: number;
  recentEpa?: number;
  trend?: "up" | "down" | "stable";
}

export interface TeamMatchBreakdown {
  matchNumber: number;
  matchSeries: number;
  level: "qual" | "playoff";
  description: string;
  alliance: "red" | "blue";
  partnerTeam: number;
  opponentTeam1: number;
  opponentTeam2: number;
  allianceScore: number;
  allianceAutoScore: number;
  allianceTeleopScore: number;
  allianceEndgameScore: number;
  opponentScore: number;
  result: "win" | "loss" | "tie";
}

export interface MatchPrediction {
  redAlliance: { team1: number; team2: number };
  blueAlliance: { team1: number; team2: number };
  prediction: {
    redScore: number;
    blueScore: number;
    redWinProbability: number;
    blueWinProbability: number;
    predictedWinner: "red" | "blue";
    margin: number;
  };
}

export interface GlobalEPARankings {
  season: number;
  totalTeams: number;
  totalMatches: number;
  eventsProcessed: number;
  lastUpdated: string;
  rankings: Array<{
    rank: number;
    teamNumber: number;
    epa: number;
    autoEpa: number;
    teleopEpa: number;
    endgameEpa: number;
    matchCount: number;
    trend: "up" | "down" | "stable";
  }>;
}

export interface TeamRankDetail {
  worldRank: number;
  worldTotal: number;
  countryRank: number | null;
  countryTotal: number | null;
  country: string | null;
  stateRank: number | null;
  stateTotal: number | null;
  stateProv: string | null;
  epa: number;
  autoEpa: number;
  teleopEpa: number;
  endgameEpa: number;
  autoWorldRank: number | null;
  teleopWorldRank: number | null;
  endgameWorldRank: number | null;
  autoCountryRank: number | null;
  teleopCountryRank: number | null;
  endgameCountryRank: number | null;
  autoStateRank: number | null;
  teleopStateRank: number | null;
  endgameStateRank: number | null;
  opr: number | null;
  autoOpr: number | null;
  teleopOpr: number | null;
  endgameOpr: number | null;
  oprWorldRank: number | null;
  oprWorldTotal: number | null;
  oprCountryRank: number | null;
  oprStateRank: number | null;
  autoOprWorldRank: number | null;
  teleopOprWorldRank: number | null;
  endgameOprWorldRank: number | null;
  autoOprCountryRank: number | null;
  teleopOprCountryRank: number | null;
  endgameOprCountryRank: number | null;
  autoOprStateRank: number | null;
  teleopOprStateRank: number | null;
  endgameOprStateRank: number | null;
}

export interface RankingFilters {
  countries: string[];
  states: Record<string, string[]>;
}

export interface EventTeamSummary {
  eventCode: string;
  eventName: string;
  city: string | null;
  stateProv: string | null;
  dateStart: string;
  rank: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  qualAverage: number | null;
}

export interface TeamProfile {
  bio: string | null;
  robotName: string | null;
  robotDesc: string | null;
  drivetrainType: string | null;
  links: Array<{ title: string; url: string }> | null;
  media: Array<{
    id: string;
    type: "CAD" | "VIDEO" | "PHOTO" | "LINK";
    title: string;
    url: string;
    description: string | null;
    sortOrder: number;
    isUpload: boolean;
    fileSize: number | null;
    mimeType: string | null;
  }>;
}

// FTCMetrics API wrapper response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
