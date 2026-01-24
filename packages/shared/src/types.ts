// User roles within a team
export type TeamRole = 'mentor' | 'member';

// Data sharing levels for scouting data
export type SharingLevel = 'private' | 'event' | 'public';

// Match phases
export type MatchPhase = 'auto' | 'teleop' | 'endgame';

// Basic user info (without sensitive data)
export interface PublicUser {
  id: string;
  name: string;
  avatar: string | null;
}

// Team info
export interface Team {
  id: string;
  teamNumber: number;
  name: string;
  sharingLevel: SharingLevel;
  createdAt: Date;
}

// Team membership
export interface TeamMember {
  userId: string;
  teamId: string;
  role: TeamRole;
  joinedAt: Date;
  user?: PublicUser;
}

// FTC Event from API
export interface FTCEvent {
  eventCode: string;
  name: string;
  startDate: string;
  endDate: string;
  venue: string;
  city: string;
  stateProv: string;
  country: string;
}

// FTC Match from API
export interface FTCMatch {
  matchNumber: number;
  tournamentLevel: string;
  red1: number;
  red2: number;
  blue1: number;
  blue2: number;
  redScore: number | null;
  blueScore: number | null;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
