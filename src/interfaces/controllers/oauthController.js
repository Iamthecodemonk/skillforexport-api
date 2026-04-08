import { OAuth2Client } from 'google-auth-library';

function getClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const port = process.env.PORT || 3000;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/auth/google/callback`;
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export function makeOauthController({ useCase }) {
  const client = getClient();

  return {
    GoogleRedirect: async (req, reply) => {
      const url = client.generateAuthUrl({
        access_type: 'offline',
        scope: ['openid', 'email', 'profile'],
        prompt: 'consent'
      });
      return reply.redirect(url);
    },

    GoogleCallback: async (req, reply) => {
      try {
        const { code } = req.query;
        if (!code) return reply.code(400).send({ error: 'code_required' });
        const { tokens } = await client.getToken(code);
        const idToken = tokens.id_token;
        if (!idToken)
          return reply.code(400).send({
            error: 'id_token_missing'
          });
        const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        const profile = { email: payload.email, name: payload.name, googleId: payload.sub };
        const result = await useCase.LoginWithGoogle({ profile });
        return reply.send(result);
      } catch (err) {
        req.log && req.log.error && req.log.error(err);
        return reply.code(500).send({ error: 'oauth_error' });
      }
    }
,

    // Accept ID token from client (mobile/SPAs) to register/login with Google
    TokenSignIn: async (req, reply) => {
      try {
        const { idToken } = req.body ;
        if (!idToken)
          return reply.code(400).send({
            error: 'idToken_required'
          });
        const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        const profile = { email: payload.email, name: payload.name, googleId: payload.sub };
        const result = await useCase.LoginWithGoogle({ profile });
        return reply.send(result);
      } catch (err) {
        req.log && req.log.error && req.log.error(err);
        return reply.code(400).send({ error: 'invalid_id_token' });
      }
    }
  };
}
