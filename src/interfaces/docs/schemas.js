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

export const AuthTokenResponse = {
  type: 'object',
  properties: {
    token: { type: ['string','null'] },
    user: { type: ['object','null'] },
    accessToken: { type: ['string','null'] },
    tokenType: { type: ['string','null'] },
    expiresIn: { type: ['number','null'] }
  }
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
  required: ['title','content'],
  properties: {
    userId: { type: 'string' },
    communityId: { type: 'string' },
    pageId: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' }
  }
};
PostCreateBody.example = { communityId: null, title: 'Hello world', content: 'Hello world — this is a test post.' };

export const PostResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    user_id: { type: 'string' },
    community_id: { type: ['string','null'] },
    page_id: { type: ['string','null'] },
    title: { type: 'string' },
    content: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' }
  }
};
PostResponse.example = { id: 'post-uuid', user_id: 'user-uuid', community_id: null, title: 'Hello world', content: 'Hello world — this is a test post.', created_at: '2026-04-09T12:00:00Z', updated_at: '2026-04-09T12:00:00Z' };

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

export const UserProfileBody = {
  type: 'object',
  description: 'Profile fields to create or update. Do NOT provide `id` or `userId` — those are generated/derived by the server.',
  properties: {
    username: { type: 'string' },
    bio: { type: 'string' },
    location: { type: 'string' },
    avatar: { type: ['string','null'] },
    banner: { type: ['string','null'] },
    website: { type: 'string' },
    linkedin: { type: 'string' },
    github: { type: 'string' }
  },
  example: {
    username: 'codemonk',
    bio: 'Developer,engineer',
    location: 'Remote',
    website: 'https://example.com',
    linkedin: 'https://linkedin.com/in/tech',
    github: 'https://github.com/tech'
  }
};

export const UserProfileResponse = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Profile record id (server-generated)', readOnly: true },
    userId: { type: 'string', description: 'User id (derived from authenticated token)', readOnly: true },
    username: { type: 'string' },
    bio: { type: 'string' },
    location: { type: 'string' },
    avatar: { type: ['string','null'] },
    banner: { type: ['string','null'] },
    website: { type: 'string' },
    linkedin: { type: 'string' },
    github: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' }
  }
};
UserProfileResponse.example = {
  id: 'profile-uuid',
  userId: 'user-uuid',
  username: 'tech',
  bio: 'Developer',
  location: 'Remote',
  avatar: null,
  banner: null,
  website: 'https://example.com',
  linkedin: 'https://linkedin.com/in/tech',
  github: 'https://github.com/tech',
  createdAt: new Date().toISOString()
};

// Item schemas for FullProfileResponse arrays (defined before FullProfileResponse)
export const Skill = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    level: { type: 'string', enum: ['beginner', 'intermediate', 'expert'] }
  }
};

export const Portfolio = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    link: { type: 'string' }
  }
};

export const Certification = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    name: { type: 'string' },
    issuer: { type: 'string' },
    issueDate: { type: 'string' }
  }
};

export const Education = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    school: { type: 'string' },
    degree: { type: 'string' },
    field: { type: 'string' },
    startDate: { type: 'string' },
    endDate: { type: ['string','null'] }
  }
};

export const Experience = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    company: { type: 'string' },
    title: { type: 'string' },
    employmentType: { type: 'string' },
    startDate: { type: 'string' },
    endDate: { type: ['string','null'] },
    isCurrent: { type: 'number' },
    description: { type: 'string' }
  }
};

export const Follower = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    followerId: { type: 'string' },
    followingId: { type: 'string' },
    createdAt: { type: 'string' }
  }
};

export const OAuthAccount = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    provider: { type: 'string' },
    providerId: { type: 'string' },
    providerEmail: { type: ['string','null'] },
    avatarUrl: { type: ['string','null'] }
  }
};

export const FullProfileResponse = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string' },
        created_at: { type: 'string' }
      }
    },
    profile: UserProfileResponse,
    skills: { type: 'array', items: Skill, example: [{ id: 'skill-uuid', name: 'JavaScript', level: 'expert' }] },
    portfolios: { type: 'array', items: Portfolio, example: [{ id: 'portfolio-uuid', userId: 'user-uuid', title: 'Personal Website', description: 'Showcase of projects', link: 'https://janedoe.dev' }] },
    certifications: { type: 'array', items: Certification, example: [{ id: 'cert-uuid', userId: 'user-uuid', name: 'AWS Certified Developer', issuer: 'Amazon', issueDate: '2023-06-01' }] },
    education: { type: 'array', items: Education, example: [{ id: 'edu-uuid', userId: 'user-uuid', school: 'State University', degree: 'BSc Computer Science', field: 'Computer Science', startDate: '2016-09-01', endDate: '2020-06-01' }] },
    experiences: { type: 'array', items: Experience, example: [{ id: 'exp-uuid', userId: 'user-uuid', company: 'Acme Co', title: 'Software Engineer', employmentType: 'full-time', startDate: '2020-07-01', endDate: null, isCurrent: 1, description: 'Worked on backend services' }] },
    followers: { type: 'array', items: Follower, example: [{ id: 'follower-uuid', followerId: 'other-user-uuid', followingId: 'user-uuid', createdAt: '2026-04-01T12:00:00Z' }] },
    oauthAccounts: { type: 'array', items: OAuthAccount, example: [{ id: 'oauth-uuid', userId: 'user-uuid', provider: 'google', providerId: 'google-123', providerEmail: 'user@example.com', avatarUrl: 'https://example.com/avatar.jpg' }] }
  }
};

export const GenericError = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    message: { type: 'string' }
  }
};

export const GenericErrorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: GenericError
  }
};
GenericErrorResponse.example = { success: false, error: { code: 'profile_already_exists', message: 'Profile already exists' } };



export const AvatarUploadBody = {
  type: 'object',
  required: ['imageUrl'],
  properties: { imageUrl: { type: 'string' } },
  example: { imageUrl: 'https://example.com/photo.jpg' }
};

export const MediaRegisterBody = {
  type: 'object',
  required: ['publicId'],
  properties: { publicId: { type: 'string' }, kind: { type: 'string' }, replace: { type: 'boolean' } },
  example: { publicId: 'banners/abcd1234', kind: 'banner' }
};

export const PostMediaResponse = {
  type: 'object',
  properties: { id: { type: 'string' }, post_id: { type: 'string' }, media_type: { type: 'string' }, url: { type: 'string' }, thumbnail_url: { type: 'string' }, display_order: { type: 'number' } }
};
PostMediaResponse.example = { id: 'media-uuid', post_id: 'post-uuid', media_type: 'image', url: 'https://res.cloudinary.com/demo/image/upload/v12345/example.jpg', thumbnail_url: 'https://res.cloudinary.com/demo/image/upload/v12345/example_thumb.jpg', display_order: 0 };

export const CommentCreateBody = {
  type: 'object',
  required: ['content'],
  properties: { userId: { type: 'string' }, content: { type: 'string' }, parentCommentId: { type: ['string','null'] } }
};

export const CommentResponse = {
  type: 'object',
  properties: { id: { type: 'string' }, post_id: { type: 'string' }, user_id: { type: 'string' }, parent_comment_id: { type: ['string','null'] }, content: { type: 'string' }, created_at: { type: 'string' } }
};

export const PageCreateBody = {
  type: 'object',
  required: ['name','slug'],
  properties: {
    categoryId: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    metadata: { type: ['object','null'] }
  },
  example: { name: 'My Page', slug: 'my-page', description: 'A public page' }
};

export const PageResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    ownerId: { type: 'string' },
    categoryId: { type: ['string','null'] },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    avatar: { type: ['string','null'] },
    coverImage: { type: ['string','null'] },
    isVerified: { type: 'number' },
    isActive: { type: 'number' },
    isApproved: { type: 'number' },
    approvalNotes: { type: ['string','null'] },
    approvedAt: { type: ['string','null'] },
    approvedBy: { type: ['string','null'] },
    metadata: { type: ['object','null'] },
    followers_count: { type: ['number','null'], description: 'Number of followers for the page (optional; present if calculated/denormalized)' },
    posts_count: { type: ['number','null'], description: 'Denormalized post count for the page (optional; present when the pages table maintains a post_count column)' },
    category_pages_count: { type: ['number','null'], description: 'Total pages in the page category (optional; present if counted)' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};

export const PageListResponse = { type: 'array', items: PageResponse };

export const PageCategoryResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    icon: { type: ['string','null'] },
    is_active: { type: 'number' },
    rules: { type: ['object','null'] },
    max_pages_per_user: { type: ['number','null'] },
    requires_approval: { type: ['number','null'] },
    validation_rules: { type: ['object','null'] },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    total_pages: { type: ['number','null'], description: 'Total pages in this category (provided by GET /page-categories/:id)' }
  }
};

export const CommentListResponse = { type: 'array', items: CommentResponse };

export const ReactionBody = {
  type: 'object',
  properties: { userId: { type: 'string' }, type: { type: 'string', enum: ['like','love','clap','dislike'], example: 'like' } }
};

export const ReactionToggleResponse = {
  type: 'object',
  properties: { result: { type: 'object' }, count: { type: 'number' } }
};

export const PostSaveBody = {
  type: 'object',
  properties: { userId: { type: 'string' } }
};

export const PostReportBody = {
  type: 'object',
  properties: { userId: { type: 'string' }, reason: { type: 'string' }, details: { type: 'string' } },
  example: { reason: 'spam', details: 'This post contains unsolicited ads' }
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
  AuthTokenResponse,
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
  , UserProfileBody
  , UserProfileResponse
  , AvatarUploadBody
  , MediaRegisterBody
  , PageCreateBody
  , PageResponse
  , PageListResponse
  , PageCategoryResponse
  , FullProfileResponse
  , FullProfileResponse
  , GenericError
  , GenericErrorResponse
  , AuthErrorResponse
  , Skill
  , Portfolio
  , Certification
  , Education
  , Experience
  , Follower
  , OAuthAccount
};
