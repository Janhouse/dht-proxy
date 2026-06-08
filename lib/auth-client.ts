import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
	plugins: [genericOAuthClient()],
});

export const { signIn } = authClient;
