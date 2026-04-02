import { betterAuth } from "better-auth"

let authInstance: ReturnType<typeof betterAuth> | undefined

export function getAuth(): ReturnType<typeof betterAuth> {
  if (!authInstance) {
    authInstance = betterAuth({
      socialProviders: {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID as string,
          clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        },
      },
    })
  }

  return authInstance
}
