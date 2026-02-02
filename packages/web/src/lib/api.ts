/**
 * API client for FTC Metrics backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  const data = await response.json();
  return data;
}

// Team Management API
export const teamsApi = {
  getMyTeams: async (userId: string) => {
    return fetchApi<Array<{
      teamId: string;
      role: string;
      team: {
        id: string;
        teamNumber: number;
        name: string;
        sharingLevel: string;
      };
    }>>(`/api/user-teams`, {
      headers: { "X-User-Id": userId },
    });
  },

  createTeam: async (userId: string, data: { teamNumber: number; name?: string }) => {
    return fetchApi<{
      id: string;
      teamNumber: number;
      name: string;
    }>("/api/user-teams", {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify(data),
    });
  },

  getTeam: async (userId: string, teamId: string) => {
    return fetchApi<{
      id: string;
      teamNumber: number;
      name: string;
      sharingLevel: string;
      members: Array<{
        id: string;
        userId: string;
        role: string;
        user: {
          id: string;
          name: string;
          email: string;
          image: string | null;
        };
      }>;
      invites: Array<{
        id: string;
        code: string;
        expiresAt: string | null;
        maxUses: number | null;
        uses: number;
      }>;
    }>(`/api/user-teams/${teamId}`, {
      headers: { "X-User-Id": userId },
    });
  },

  updateTeam: async (
    userId: string,
    teamId: string,
    data: { name?: string; sharingLevel?: string }
  ) => {
    return fetchApi(`/api/user-teams/${teamId}`, {
      method: "PATCH",
      headers: { "X-User-Id": userId },
      body: JSON.stringify(data),
    });
  },

  createInvite: async (
    userId: string,
    teamId: string,
    data: { maxUses?: number; expiresInDays?: number; role?: string }
  ) => {
    return fetchApi<{
      id: string;
      code: string;
      expiresAt: string | null;
    }>(`/api/user-teams/${teamId}/invites`, {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify(data),
    });
  },

  joinTeam: async (userId: string, code: string) => {
    return fetchApi<{
      teamId: string;
      role: string;
    }>("/api/user-teams/join", {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify({ code }),
    });
  },

  updateMember: async (
    userId: string,
    teamId: string,
    memberId: string,
    data: { role: string }
  ) => {
    return fetchApi(`/api/user-teams/${teamId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "X-User-Id": userId },
      body: JSON.stringify(data),
    });
  },

  removeMember: async (userId: string, teamId: string, memberId: string) => {
    return fetchApi(`/api/user-teams/${teamId}/members/${memberId}`, {
      method: "DELETE",
      headers: { "X-User-Id": userId },
    });
  },

  leaveTeam: async (userId: string, teamId: string) => {
    return fetchApi(`/api/user-teams/${teamId}/leave`, {
      method: "POST",
      headers: { "X-User-Id": userId },
    });
  },
};

// Scouting API
export const scoutingApi = {
  submitEntry: async (
    userId: string,
    data: {
      scoutingTeamId: string;
      scoutedTeamNumber: number;
      eventCode: string;
      matchNumber: number;
      alliance: "RED" | "BLUE";
      autoLeave?: boolean;
      autoClassifiedCount?: number;
      autoOverflowCount?: number;
      autoPatternCount?: number;
      teleopClassifiedCount?: number;
      teleopOverflowCount?: number;
      teleopDepotCount?: number;
      teleopPatternCount?: number;
      teleopMotifCount?: number;
      endgameBaseStatus?: "NONE" | "PARTIAL" | "FULL";
    }
  ) => {
    return fetchApi("/api/scouting/entries", {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify(data),
    });
  },

  getEntries: async (
    userId: string,
    filters?: { eventCode?: string; teamNumber?: number; scoutingTeamId?: string }
  ) => {
    const params = new URLSearchParams();
    if (filters?.eventCode) params.set("eventCode", filters.eventCode);
    if (filters?.teamNumber) params.set("teamNumber", String(filters.teamNumber));
    if (filters?.scoutingTeamId) params.set("scoutingTeamId", filters.scoutingTeamId);

    return fetchApi(`/api/scouting/entries?${params.toString()}`, {
      headers: { "X-User-Id": userId },
    });
  },

  updateEntry: async (
    userId: string,
    entryId: string,
    data: Partial<{
      matchNumber: number;
      alliance: "RED" | "BLUE";
      autoLeave: boolean;
      autoClassifiedCount: number;
      autoOverflowCount: number;
      autoPatternCount: number;
      teleopClassifiedCount: number;
      teleopOverflowCount: number;
      teleopDepotCount: number;
      teleopPatternCount: number;
      teleopMotifCount: number;
      endgameBaseStatus: "NONE" | "PARTIAL" | "FULL";
    }>
  ) => {
    return fetchApi(`/api/scouting/entries/${entryId}`, {
      method: "PATCH",
      headers: { "X-User-Id": userId },
      body: JSON.stringify(data),
    });
  },

  getTeamSummary: async (teamNumber: number, eventCode?: string) => {
    const params = eventCode ? `?eventCode=${eventCode}` : "";
    return fetchApi<{
      teamNumber: number;
      matchCount: number;
      averages: {
        autoScore: number;
        teleopScore: number;
        endgameScore: number;
        totalScore: number;
        autoLeaveRate: number;
        autoClassified: number;
        autoOverflow: number;
        teleopClassified: number;
        teleopOverflow: number;
        teleopDepot: number;
      } | null;
    }>(`/api/scouting/team-summary/${teamNumber}${params}`);
  },

  submitNote: async (
    userId: string,
    data: {
      notingTeamId: string;
      aboutTeamNumber: number;
      eventCode?: string;
      reliabilityRating?: number;
      driverSkillRating?: number;
      defenseRating?: number;
      strategyNotes?: string;
      mechanicalNotes?: string;
      generalNotes?: string;
    }
  ) => {
    return fetchApi("/api/scouting/notes", {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify(data),
    });
  },

  getNotes: async (filters?: {
    aboutTeamNumber?: number;
    eventCode?: string;
    notingTeamId?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.aboutTeamNumber)
      params.set("aboutTeamNumber", String(filters.aboutTeamNumber));
    if (filters?.eventCode) params.set("eventCode", filters.eventCode);
    if (filters?.notingTeamId) params.set("notingTeamId", filters.notingTeamId);

    return fetchApi(`/api/scouting/notes?${params.toString()}`);
  },

  getTeamStats: async (userId: string, teamId: string) => {
    return fetchApi<{
      matchesScouted: number;
      eventsCount: number;
      teamsScoutedCount: number;
      notesCount: number;
    }>(`/api/scouting/team-stats/${teamId}`, {
      headers: { "X-User-Id": userId },
    });
  },

  deductPartner: async (userId: string, entryId: string) => {
    return fetchApi(`/api/scouting/entries/${entryId}/deduct-partner`, {
      method: "POST",
      headers: { "X-User-Id": userId },
    });
  },
};

// Events API
export const eventsApi = {
  getEvents: async () => {
    return fetchApi<Array<{
      code: string;
      name: string;
      city: string;
      stateprov: string;
      country: string;
      dateStart: string;
      dateEnd: string;
      type: string;
    }>>("/api/events");
  },

  getEvent: async (eventCode: string) => {
    return fetchApi(`/api/events/${eventCode}`);
  },

  getEventTeams: async (eventCode: string) => {
    return fetchApi<Array<{
      teamNumber: number;
      nameFull: string;
      nameShort: string;
      city: string;
      stateProv: string;
    }>>(`/api/events/${eventCode}/teams`);
  },

  getEventSchedule: async (eventCode: string, level: "qual" | "playoff" = "qual") => {
    return fetchApi(`/api/events/${eventCode}/schedule?level=${level}`);
  },

  getEventMatches: async (eventCode: string, level: "qual" | "playoff" = "qual") => {
    return fetchApi(`/api/events/${eventCode}/matches?level=${level}`);
  },

  getEventRankings: async (eventCode: string) => {
    return fetchApi(`/api/events/${eventCode}/rankings`);
  },
};

// Teams API (FTC team lookup)
export const ftcTeamsApi = {
  getTeam: async (teamNumber: number) => {
    return fetchApi<{
      teamNumber: number;
      nameFull: string;
      nameShort: string;
      city: string;
      stateProv: string;
      country: string;
      rookieYear: number;
    }>(`/api/teams/${teamNumber}`);
  },

  getTeamEvents: async (teamNumber: number) => {
    return fetchApi(`/api/teams/${teamNumber}/events`);
  },
};

// Analytics API
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

export const analyticsApi = {
  getOPR: async (eventCode: string) => {
    return fetchApi<{
      eventCode: string;
      matchCount: number;
      rankings: OPRResult[];
    }>(`/api/analytics/opr/${eventCode}`);
  },

  getEPA: async (eventCode: string) => {
    return fetchApi<{
      eventCode: string;
      matchCount: number;
      rankings: EPAResult[];
    }>(`/api/analytics/epa/${eventCode}`);
  },

  getTeamAnalytics: async (teamNumber: number, eventCode?: string) => {
    const params = eventCode ? `?eventCode=${eventCode}` : "";
    return fetchApi<{
      teamNumber: number;
      eventCode?: string;
      opr: OPRResult | null;
      epa: EPAResult | null;
    }>(`/api/analytics/team/${teamNumber}${params}`);
  },

  predictMatch: async (data: {
    eventCode: string;
    redTeam1: number;
    redTeam2: number;
    blueTeam1: number;
    blueTeam2: number;
  }) => {
    return fetchApi<{
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
    }>("/api/analytics/predict", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  compareTeams: async (eventCode: string, teams: number[]) => {
    return fetchApi<{
      eventCode: string;
      teams: Array<{
        teamNumber: number;
        opr: OPRResult | null;
        epa: EPAResult | null;
      }>;
    }>(`/api/analytics/compare?eventCode=${eventCode}&teams=${teams.join(",")}`);
  },
};
