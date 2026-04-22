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



// Public user representation returned by auth flows (controllers attach `api_token`)
export const UserPublic = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    username: { type: ['string','null'] },
    api_token: { type: ['string','null'] }
  },
  example: { id: 'user-uuid', email: 'user@example.com', username: 'janedoe', api_token: 'eyJhbGciOiJI...' }
};

// For simpler routes that previously returned token-like payloads, prefer returning the user object with `api_token`.
// Keep backward-compatible shapes by using `UserPublic` for login/token responses.
export const LoginResponse = { ...UserPublic };
export const TokenSignInResponse = { ...UserPublic };
export const AuthTokenResponse = { ...UserPublic };

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
    error: {...AuthError}
  }
};
AuthErrorResponse.example = { success: false, error: { code: 'invalid_credentials', message: 'Invalid email or password' } };

export const TokenSignInBody = {
  type: 'object',
  required: ['idToken'],
  properties: { idToken: { type: 'string' } }
};


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

export const ApiStringResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: ['string','null'] },
    data: { type: ['string','null'] }
  },
  example: { success: true, message: 'OTP sent successfully', data: 'temp_session_token_xyz' }
};

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
    , mediaAssetIds: { type: 'array', items: { type: 'string' }, description: 'Optional list of media asset ids (uploaded via /media/register or asset endpoints). All assets must be processed and have a URL before creating a post.' }
  }
};
PostCreateBody.example = { communityId: null, title: 'Hello world', content: 'Hello world — this is a test post.', mediaAssetIds: ['asset-uuid-123'] };

export const QuestionCreateBody = {
  type: 'object',
  required: ['title','body'],
  properties: {
    communityId: { type: 'string' },
    title: { type: 'string' },
    body: { type: 'string' },
    visibility: { type: 'string', enum: ['public','community_only','community_public'] }
  }
};
QuestionCreateBody.example = { communityId: null, title: 'How do I configure X?', body: 'I tried Y but get error Z' };

export const QuestionResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    communityId: { type: ['string','null'] },
    title: { type: 'string' },
    body: { type: 'string' },
    visibility: { type: 'string' },
    isClosed: { type: 'boolean' },
    acceptedAnswerId: { type: ['string','null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    answers: { type: ['array','null'], items: { type: 'object' } }
  }
};
QuestionResponse.example = {
  id: 'q-uuid',
  userId: 'user-uuid',
  communityId: null,
  title: 'How to...',
  body: 'Details...',
  visibility: 'public',
  isClosed: false,
  acceptedAnswerId: null,
  createdAt: '2026-04-01T12:00:00Z',
  updatedAt: '2026-04-01T12:00:00Z',
  answers: [
    {
      id: 'a-uuid',
      questionId: 'q-uuid',
      userId: 'user-uuid',
      parentAnswerId: null,
      content: 'This is how...',
      createdAt: '2026-04-01T13:00:00Z',
      updatedAt: '2026-04-01T13:00:00Z'
    }
  ]
};

export const QuestionListResponse = { type: 'array', items: QuestionResponse };

export const AnswerCreateBody = { type: 'object', required: ['content'], properties: { content: { type: 'string' }, parentAnswerId: { type: ['string','null'] } } };
AnswerCreateBody.example = { content: 'You can fix it by...' };

export const AnswerResponse = { type: 'object', properties: { id: { type: 'string' }, questionId: { type: 'string' }, userId: { type: 'string' }, parentAnswerId: { type: ['string','null'] }, content: { type: 'string' }, createdAt: { type: 'string' }, updatedAt: { type: 'string' } } };
AnswerResponse.example = { id: 'a-uuid', questionId: 'q-uuid', userId: 'user-uuid', parentAnswerId: null, content: 'This is how...', createdAt: '2026-04-01T13:00:00Z', updatedAt: '2026-04-01T13:00:00Z' };


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

export const MediaError = {
  type: 'object',
  properties: {
    assetId: { type: 'string' },
    code: { type: 'string' },
    message: { type: 'string' }
  }
};

export const MediaValidationErrorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'array', items: MediaError }
      }
    }
  }
};
MediaValidationErrorResponse.example = { success: false, error: { code: 'media_not_ready', message: 'One or more media assets are not yet processed', details: [ { assetId: 'asset-uuid-123', code: 'file_too_large', message: 'File exceeds 10MB' }, { assetId: 'asset-uuid-456', code: 'unsupported_media_type', message: 'Invalid file format: .exe' } ] } };

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
  createdAt: '2026-04-13T00:00:00Z'
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

// schemas.js
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
    profile: { ...UserProfileResponse }, // <--- Use spread
    skills: { type: 'array', items: { ...Skill } }, // <--- Use spread
    portfolios: { type: 'array', items: { ...Portfolio } }, // <--- Use spread
    certifications: { type: 'array', items: { ...Certification } }, // <--- Use spread
    education: { type: 'array', items: { ...Education } }, // <--- Use spread
    experiences: { type: 'array', items: { ...Experience } }, // <--- Use spread
    followers: { type: 'array', items: { ...Follower } }, // <--- Use spread
    oauthAccounts: { type: 'array', items: { ...OAuthAccount } } // <--- Use spread
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
  error: {...GenericError}
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
  properties: { publicId: { type: 'string' }, kind: { type: 'string' }, replace: { type: 'boolean' }, pageId: { type: ['string','null'] } },
  example: { publicId: 'banners/abcd1234', kind: 'banner', pageId: null }
};

export const JobAcceptedResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: { jobId: { type: 'string' } } }
  }
};

export const CloudinarySignatureResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        cloudName: { type: 'string' },
        apiKey: { type: 'string' },
        timestamp: { type: 'number' },
        signature: { type: 'string' }
      }
    }
  }
};

export const MediaJobStatusResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        state: { type: 'string' },
        attemptsMade: { type: 'number' },
        failedReason: { type: ['string','null'] },
        friendlyMessage: { type: ['string','null'] },
        returnvalue: { type: ['object','null'] },
        data: { type: ['object','null'] }
      }
    }
  }
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

export const PageCategoryCreateBody = {
  type: 'object',
  required: ['name','slug'],
  properties: {
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    icon: { type: 'string' },
    is_active: { type: 'number' },
    rules: { type: ['object','null'] },
    max_pages_per_user: { type: ['number','null'] },
    requires_approval: { type: ['number','null'] },
    validation_rules: { type: ['object','null'] }
  },
  example: { name: 'Community', slug: 'community', description: 'Community pages', icon: 'users', is_active: 1 }
};

// More comprehensive example for admin creation flows (shows all optional fields)
PageCategoryCreateBody.example = {
  name: 'Community',
  slug: 'community',
  description: 'Community pages for user groups, discussions and events.',
  icon: 'users',
  is_active: 1,
  // Rules object can contain arbitrary enforcement flags consumed by the application
  rules: {
    allowPosting: true,
    allowMedia: true,
    requireMembership: false,
    profanityFilter: true
  },
  // Limit how many pages a single user may create in this category
  max_pages_per_user: 5,
  // 1 = requires admin approval to publish a page, 0 = auto-approve
  requires_approval: 1,
  // Validation rules used by the server when creating pages in this category
  validation_rules: {
    slugPattern: '^[a-z0-9-]+$',
    minNameLength: 3,
    maxNameLength: 60
  }
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

export const CommunityCategoryCreateBody = {
  type: 'object',
  required: ['name'],
  properties: { name: { type: 'string' }, description: { type: 'string' } },
  example: { name: 'Sports', description: 'Groups for sports fans' }
};

export const CommunityCategoryResponse = {
  type: 'object',
  properties: { id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' } }
};

export const CommunityCreateBody = {
  type: 'object',
  required: ['name'],
  properties: { name: { type: 'string' }, description: { type: 'string' }, categoryId: { type: 'string' }, defaultPostVisibility: { type: 'string', enum: ['public','connections','community'] } },
  example: { name: 'Local Chess Club', description: 'We meet weekly to play chess', categoryId: null, defaultPostVisibility: 'public' }
};

export const CommunityUpdateBody = {
  type: 'object',
  properties: { name: { type: 'string' }, description: { type: 'string' }, defaultPostVisibility: { type: 'string', enum: ['public','connections','community'] }, is_active: { type: 'number' } },
  example: { name: 'Chess Club', description: 'Updated desc', defaultPostVisibility: 'community', is_active: 1 }
};

export const CommunityResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    categoryId: { type: ['string','null'] },
    name: { type: 'string' },
    description: { type: 'string' },
    is_active: { type: 'number' },
    default_post_visibility: { type: ['string','null'], description: 'Default visibility for new posts in this community' },
    created_at: { type: 'string' }
  }
};

export const CommunityMemberResponse = {
  type: 'object',
  properties: { id: { type: 'string' }, userId: { type: 'string' }, communityId: { type: 'string' }, role: { type: 'string' } }
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
  PostMediaResponse,
  // Questions & Answers
  QuestionCreateBody,
  QuestionResponse,
  QuestionListResponse,
  AnswerCreateBody,
  AnswerResponse,
  CommentCreateBody,
  CommentResponse,
  CommentListResponse,
  ReactionBody,
  ReactionToggleResponse,
  PostSaveBody,
  PostReportBody,
  PostReportResponse,
  UserProfileBody,
  UserProfileResponse,
  AvatarUploadBody,
  ApiStringResponse,
  MediaRegisterBody,
  JobAcceptedResponse,
  CloudinarySignatureResponse,
  MediaJobStatusResponse,
  PageCategoryCreateBody,
  PageCreateBody,
  PageResponse,
  PageListResponse,
  PageCategoryResponse,
  CommunityCategoryCreateBody,
  CommunityCategoryResponse,
  CommunityCreateBody,
  CommunityResponse,
  CommunityMemberResponse,
  CommunityUpdateBody,
  FullProfileResponse,
  GenericError,
  GenericErrorResponse,
  AuthErrorResponse,
  Skill,
  Portfolio,
  Certification,
  Education,
  Experience,
  Follower,
  OAuthAccount
};
