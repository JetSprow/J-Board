export interface AccountPanelUser {
  email: string;
  emailVerifiedAt: string | null;
  name: string | null;
  inviteCode: string | null;
  createdAt: string;
  invitedUsersCount: number;
  inviteRewardCount: number;
  inviteRewardAmount: number;
}
