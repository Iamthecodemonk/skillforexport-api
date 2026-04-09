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
  description: 'Standard email/password login request. This endpoint does not require an OTP for normal authentication flows.',
  properties: { email: { type: 'string' }, password: { type: 'string' } }
};
LoginBody.example = { email: 'user@example.com', password: 'P@ssw0rd' };

export const LoginResponse = {
  type: 'object',
  properties: { accessToken: { type: 'string' }, tokenType: { type: 'string' }, expiresIn: { type: 'number' } }
};

export const AuthError = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    message: { type: 'string' }
  }
};

export const AuthErrorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: AuthError
  }
};
AuthErrorResponse.example = { success: false, error: { code: 'invalid_credentials', message: 'Invalid email or password' } };

export const TokenSignInBody = {
  type: 'object',
  required: ['idToken'],
  properties: { idToken: { type: 'string' } }
};

export const TokenSignInResponse = { type: 'object', properties: { accessToken: { type: 'string' } } };

export const RequestOtpBody = {
  type: 'object',
  required: ['email'],
  properties: {
    email: { type: 'string' },
    purpose: {
      type: 'string',
      description: "Optional. Label describing why the OTP is requested. Common values: 'login', 'email_verification', 'password_reset', 'two_factor', 'registration'. Servers may use this to scope or validate OTPs; if omitted the server will apply a sensible default.",
      enum: ['login', 'email_verification', 'password_reset', 'two_factor', 'registration'],
      example: 'password_reset'
    }
  }
};
RequestOtpBody.example = { email: 'user@example.com', purpose: 'password_reset' };

export const VerifyOtpBody = {
  type: 'object',
  required: ['email', 'otpCode'],
  properties: {
    email: { type: 'string' },
    otpCode: { type: 'string' },
    purpose: {
      type: 'string',
      description: "Optional. The purpose label that was used when requesting the OTP (e.g. 'password_reset' or 'two_factor'). Supplying this helps the server match the OTP to the intended flow; omit if unsure.",
      enum: ['login', 'email_verification', 'password_reset', 'two_factor', 'registration'],
      example: 'password_reset'
    }
  }
};
VerifyOtpBody.example = { email: 'user@example.com', otpCode: '123456', purpose: 'registration' };

export const ResetPasswordBody = {
  type: 'object',
  required: ['email', 'otpCode', 'newPassword'],
  properties: {
    email: { type: 'string' },
    otpCode: { type: 'string', description: "Password reset token sent to the user's email (or OTP). For password resets this is the secure token from the reset link.", example: 'f3a8... (token)'
    },
    newPassword: { type: 'string' }
  },
  example: { email: 'user@example.com', otpCode: 'f3a8...token', newPassword: 'NewP@ssw0rd' }
};

export const RegisterBody = {
  type: 'object',
  required: ['email', 'password'],
  properties: { email: { type: 'string' }, password: { type: 'string' } }
};

export const PostCreateBody = {
  type: 'object',
  required: ['userId','content'],
  properties: {
    userId: { type: 'string' },
    communityId: { type: 'string' },
    content: { type: 'string' }
  }
};
PostCreateBody.example = { userId: 'user-uuid', communityId: null, content: 'Hello world — this is a test post.' };

export const PostResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    user_id: { type: 'string' },
    community_id: { type: ['string','null'] },
    content: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' }
  }
};
PostResponse.example = { id: 'post-uuid', user_id: 'user-uuid', community_id: null, content: 'Hello world — this is a test post.', created_at: '2026-04-09T12:00:00Z', updated_at: '2026-04-09T12:00:00Z' };

export const PostListResponse = {
  type: 'array',
  items: PostResponse
};
PostListResponse.example = [PostResponse.example];

export const PostMediaAttachBody = {
  type: 'object',
  required: ['url'],
  properties: { url: { type: 'string' }, mediaType: { type: 'string' }, displayOrder: { type: 'number' } }
};
PostMediaAttachBody.example = { url: 'https://example.com/image.jpg', mediaType: 'image', displayOrder: 0 };

export const PostMediaResponse = {
  type: 'object',
  properties: { id: { type: 'string' }, post_id: { type: 'string' }, media_type: { type: 'string' }, url: { type: 'string' }, thumbnail_url: { type: 'string' }, display_order: { type: 'number' } }
};
PostMediaResponse.example = { id: 'media-uuid', post_id: 'post-uuid', media_type: 'image', url: 'https://res.cloudinary.com/demo/image/upload/v12345/example.jpg', thumbnail_url: 'https://res.cloudinary.com/demo/image/upload/v12345/example_thumb.jpg', display_order: 0 };

export const CommentCreateBody = {
  type: 'object',
  required: ['userId','content'],
  properties: { userId: { type: 'string' }, content: { type: 'string' }, parentCommentId: { type: ['string','null'] } }
};

export const CommentResponse = {
  type: 'object',
  properties: { id: { type: 'string' }, post_id: { type: 'string' }, user_id: { type: 'string' }, parent_comment_id: { type: ['string','null'] }, content: { type: 'string' }, created_at: { type: 'string' } }
};

export const CommentListResponse = { type: 'array', items: CommentResponse };

export const ReactionBody = {
  type: 'object',
  required: ['userId'],
  properties: { userId: { type: 'string' }, type: { type: 'string', enum: ['like','love','clap','dislike'], example: 'like' } }
};

export const ReactionToggleResponse = {
  type: 'object',
  properties: { result: { type: 'object' }, count: { type: 'number' } }
};

export const PostSaveBody = {
  type: 'object',
  required: ['userId'],
  properties: { userId: { type: 'string' } }
};

export const PostReportBody = {
  type: 'object',
  required: ['userId'],
  properties: { userId: { type: 'string' }, reason: { type: 'string' }, details: { type: 'string' } },
  example: { userId: 'user-uuid', reason: 'spam', details: 'This post contains unsolicited ads' }
};

export const PostReportResponse = {
  type: 'object',
  properties: { id: { type: 'string' }, post_id: { type: 'string' }, user_id: { type: 'string' }, reason: { type: 'string' }, details: { type: 'string' }, created_at: { type: 'string' } }
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
  PostCreateBody,
  PostResponse,
  PostListResponse,
  PostMediaAttachBody,
  PostMediaResponse
  , CommentCreateBody
  , CommentResponse
  , CommentListResponse
  , ReactionBody
  , ReactionToggleResponse
  , PostSaveBody
  , PostReportBody
  , PostReportResponse
};
