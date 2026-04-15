import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import logger from '../../utils/logger.js';
dotenv.config();

function getClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // const port = process.env.PORT || 3000;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export function makeOauthController({ useCase }) {
  const client = getClient();
  const log = logger.child('OAUTH');

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
        const decoded = jwt.decode(result.token) || {};
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp ? Math.max(0, decoded.exp - now) : 0;
          const frontend = process.env.FRONTEND_URL;
          const redirectUrl = `${frontend.replace(/\/$/, '')}/auth/google/callback#accessToken=${encodeURIComponent(result.token)}`;
          log.info('OAuth redirect to frontend', { redirectUrl });
          return reply.redirect(redirectUrl);
      } catch (err) {
          log.error('GoogleCallback error', { error: err && err.message, stack: err && err.stack });
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
        const decoded = jwt.decode(result.token) || {};
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp ? Math.max(0, decoded.exp - now) : 0;
        return reply.code(200).send({ success: true, data: { accessToken: result.token, tokenType: 'Bearer', expiresIn } });
      } catch (err) {
        log.error('TokenSignIn invalid id token', { error: err && err.message });
        return reply.code(400).send({ error: 'invalid_id_token' });
      }
    }
  };
}
