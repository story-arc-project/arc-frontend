export interface VerifyEmailResponse {
  status: string;
  data: { user: { nickname: string; email: string }; onboarded: boolean; expire_at: string };
}

export type AuthSuccessResult = {
 status : string,
 message : string,
 data : {
    user : {
        email : string
    }
 },
 onboarded : boolean,
 expire_at : string
}

export interface Account {
  email: string;
  has_password: boolean;
  email_verified: boolean;
  connected_oauth: string[];
}

export interface Profile {
  name: string;
  birth: string;
  phone: string;
  education: string;
  school: string;
  department: string;
  worry: string[];
  interest: string[];
}

export interface AuthUser {
  account: Account;
  profile: Profile | null;
  onboarded: boolean;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}