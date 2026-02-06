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

  // Only set Content-Type for requests with a body (POST, PUT, PATCH, etc.)
  // Setting it on GET requests triggers unnecessary CORS preflight
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };
  if (options.body) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
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
      bio: string | null;
      robotName: string | null;
      robotDesc: string | null;
      drivetrainType: string | null;
      links: Array<{ title: string; url: string }> | null;
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
    }>(`/api/user-teams/${teamId}`, {
      headers: { "X-User-Id": userId },
    });
  },

  updateTeam: async (
    userId: string,
    teamId: string,
    data: {
      name?: string;
      sharingLevel?: string;
      bio?: string;
      robotName?: string;
      robotDesc?: string;
      drivetrainType?: string;
      links?: Array<{ title: string; url: string }> | null;
    }
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

  addMedia: async (
    userId: string,
    teamId: string,
    data: { type: "CAD" | "VIDEO" | "PHOTO"; title: string; url: string; description?: string }
  ) => {
    return fetchApi<{
      id: string;
      type: "CAD" | "VIDEO" | "PHOTO";
      title: string;
      url: string;
      description: string | null;
      sortOrder: number;
      isUpload: boolean;
      fileSize: number | null;
      mimeType: string | null;
    }>(`/api/user-teams/${teamId}/media`, {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify(data),
    });
  },

  uploadMedia: async (
    userId: string,
    teamId: string,
    data: { type: "PHOTO" | "VIDEO"; title: string; description?: string; file: File }
  ) => {
    const formData = new FormData();
    formData.append("type", data.type);
    formData.append("title", data.title);
    if (data.description) formData.append("description", data.description);
    formData.append("file", data.file);

    const url = `${API_URL}/api/user-teams/${teamId}/media`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: formData,
      credentials: "include",
    });
    return response.json() as Promise<ApiResponse<{
      id: string;
      type: "PHOTO" | "VIDEO";
      title: string;
      url: string;
      description: string | null;
      sortOrder: number;
      isUpload: boolean;
      fileSize: number | null;
      mimeType: string | null;
    }>>;
  },

  updateMedia: async (
    userId: string,
    teamId: string,
    mediaId: string,
    data: { title?: string; url?: string; description?: string; sortOrder?: number }
  ) => {
    return fetchApi(`/api/user-teams/${teamId}/media/${mediaId}`, {
      method: "PATCH",
      headers: { "X-User-Id": userId },
      body: JSON.stringify(data),
    });
  },

  removeMedia: async (userId: string, teamId: string, mediaId: string) => {
    return fetchApi(`/api/user-teams/${teamId}/media/${mediaId}`, {
      method: "DELETE",
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
      allianceNotes?: string;
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
      allianceNotes: string;
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

  retryDeductions: async (
    userId: string,
    data: { eventCode: string; scoutingTeamId: string }
  ) => {
    return fetchApi<{
      deducted: number;
      skipped: number;
      failed: number;
      total: number;
    }>("/api/scouting/retry-deductions", {
      method: "POST",
      headers: { "X-User-Id": userId },
      body: JSON.stringify(data),
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

  search: async (query: string) => {
    return fetchApi<
      Array<{
        teamNumber: number;
        nameShort: string;
        nameFull: string;
        city: string | null;
        stateProv: string | null;
      }>
    >(`/api/teams/search?q=${encodeURIComponent(query)}`);
  },

  getTeamProfile: async (teamNumber: number, userId?: string) => {
    return fetchApi<{
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
    } | null>(`/api/teams/${teamNumber}/profile`, {
      headers: userId ? { "X-User-Id": userId } : {},
    });
  },

  getTeamEventSummaries: async (teamNumber: number) => {
    return fetchApi<
      Array<{
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
      }>
    >(`/api/teams/${teamNumber}/event-summaries`);
  },
};

// Rankings API (global season-wide)
export const rankingsApi = {
  getGlobalEPA: async () => {
    return fetchApi<{
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
    }>("/api/rankings/epa");
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

  getTeamMatches: async (teamNumber: number, eventCode: string) => {
    return fetchApi<{
      teamNumber: number;
      eventCode: string;
      matches: TeamMatchBreakdown[];
    }>(`/api/analytics/team/${teamNumber}/matches?eventCode=${encodeURIComponent(eventCode)}`);
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
