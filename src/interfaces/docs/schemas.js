// Shared JSON Schemas for API documentation
export const ItemCreateBody = {
  type: 'object',
  required: ['name'],
  properties: { name: { type: 'string' } }
};

export const ItemResponse = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' }
  }
};

export const LoginBody = {
  type: 'object',
  required: ['email', 'password'],
  properties: { email: { type: 'string' }, password: { type: 'string' } }
};

export const LoginResponse = {
  type: 'object',
  properties: { accessToken: { type: 'string' }, tokenType: { type: 'string' }, expiresIn: { type: 'number' } }
};

export const TokenSignInBody = {
  type: 'object',
  required: ['idToken'],
  properties: { idToken: { type: 'string' } }
};

export const TokenSignInResponse = { type: 'object', properties: { accessToken: { type: 'string' } } };

export const RequestOtpBody = {
  type: 'object',
  required: ['email'],
  properties: { email: { type: 'string' }, purpose: { type: 'string' } }
};

export const VerifyOtpBody = {
  type: 'object',
  required: ['email', 'otpCode'],
  properties: { email: { type: 'string' }, otpCode: { type: 'string' }, purpose: { type: 'string' } }
};

export const ResetPasswordBody = {
  type: 'object',
  required: ['email', 'newPassword'],
  properties: { email: { type: 'string' }, newPassword: { type: 'string' } }
};

export const RegisterBody = {
  type: 'object',
  required: ['email', 'password'],
  properties: { email: { type: 'string' }, password: { type: 'string' } }
};

export default {
  ItemCreateBody,
  ItemResponse,
  LoginBody,
  LoginResponse,
  TokenSignInBody,
  TokenSignInResponse,
  RequestOtpBody,
  VerifyOtpBody,
  ResetPasswordBody,
  RegisterBody,
};
