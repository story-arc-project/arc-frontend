import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
      plan?: "free" | "pro";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    plan?: "free" | "pro";
  }
}
