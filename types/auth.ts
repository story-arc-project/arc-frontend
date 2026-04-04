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