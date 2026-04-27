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
    message: { type: 'string' },
    data: { type: ['object', 'null'] }
  }
};
AuthErrorResponse.example = { success: false, message: 'Token invalid or expired', data: null };

export const MessageOnlyErrorResponse = {
  type: 'object',
  properties: {
    message: { type: 'string' }
  }
};
MessageOnlyErrorResponse.example = { message: 'Invalid credentials' };

export const ValidationErrorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        errors: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  }
};
ValidationErrorResponse.example = {
  success: false,
  message: 'email is required',
  data: { errors: { email: ['email is required'] } }
};

export const TokenSignInBody = {
  type: 'object',
  required: ['id_token'],
  description: 'Google ID token obtained from the client after a successful Google sign-in flow.',
  properties: { id_token: { type: 'string' } }
};
TokenSignInBody.example = { id_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...' };


export const RequestOtpBody = {
  type: 'object',
  required: ['email'],
  properties: {
    email: { type: 'string' }
  }
};
RequestOtpBody.example = { email: 'user@example.com' };

export const ApiStringResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: ['string','null'] },
    data: { type: ['string','null'] }
  },
  example: { success: true, message: 'OTP sent to your email', data: 'user@example.com' }
};

export const EmptyObjectSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      additionalProperties: true
    }
  },
  example: { success: true, message: 'Password set successfully', data: {} }
};

export const VerifyOtpBody = {
  type: 'object',
  required: ['email', 'otp'],
  properties: {
    email: { type: 'string' },
    otp: { type: 'string' }
  }
};
VerifyOtpBody.example = { email: 'user@example.com', otp: '123456' };

export const RegisterSetPasswordBody = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string' },
    password: { type: 'string' }
  },
  example: { email: 'user@example.com', password: 'P@ssw0rd123' }
};

export const ResetPasswordBody = {
  type: 'object',
  required: ['email', 'password', 'password_confirmation'],
  anyOf: [
    { required: ['otp'] },
    { required: ['token'] }
  ],
  properties: {
    otp: { type: 'string', example: '123456' },
    token: { type: 'string', example: 'f3a8...token' },
    email: { type: 'string', example: 'user@example.com' },
    password: { type: 'string', example: 'NewP@ssw0rd123' },
    password_confirmation: { type: 'string', example: 'NewP@ssw0rd123' }
  },
  example: {
    token: 'f3a8...token',
    email: 'user@example.com',
    password: 'NewP@ssw0rd123',
    password_confirmation: 'NewP@ssw0rd123'
  }
};

export const RegisterCompleteBody = {
  type: 'object',
  required: ['email', 'name'],
  description: 'Complete registration after OTP verification.',
  properties: {
    email: { type: 'string', example: 'user@example.com' },
    name: { type: 'string', example: 'Jane Doe' },
    ref_code: { type: 'string', example: 'ABC123' }
  }
};
RegisterCompleteBody.example = { email: 'user@example.com', name: 'Jane Doe', ref_code: 'ABC123' };

export const ChangePasswordBody = {
  type: 'object',
  required: ['current_password', 'password', 'password_confirmation'],
  description: 'Change the password for the authenticated user.',
  properties: {
    current_password: { type: 'string', example: 'OldP@ssw0rd' },
    password: { type: 'string', example: 'NewP@ssw0rd123' },
    password_confirmation: { type: 'string', example: 'NewP@ssw0rd123' }
  }
};
ChangePasswordBody.example = {
  current_password: 'OldP@ssw0rd',
  password: 'NewP@ssw0rd123',
  password_confirmation: 'NewP@ssw0rd123'
};

export const ChangeEmailBody = {
  type: 'object',
  required: ['new_email'],
  description: 'Change the email address for the authenticated user.',
  properties: {
    new_email: { type: 'string', example: 'new-email@example.com' }
  }
};
ChangeEmailBody.example = { new_email: 'new-email@example.com' };

export const AuthSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: ['string', 'null'] },
    token: { type: ['string', 'null'] },
    data: AuthTokenResponse
  },
  example: {
    success: true,
    token: 'eyJhbGciOiJI...',
    data: {
      id: 'user-uuid',
      email: 'user@example.com',
      username: 'janedoe',
      api_token: 'eyJhbGciOiJI...'
    }
  }
};

export const SimpleSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: ['string', 'null'] }
  },
  example: { success: true, message: 'Operation completed successfully' }
};

export const EmptyArraySuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'array',
      items: {}
    }
  },
  example: { success: true, message: 'Deleted success', data: [] }
};

export const EmailObjectSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        email: { type: 'string' }
      }
    }
  },
  example: { success: true, message: 'Email change requested. Please verify.', data: { email: 'new-email@example.com' } }
};

export const IdSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      }
    }
  },
  example: { success: true, data: { id: 'user-uuid' } }
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
PostResponse.example = { 
  id: 'post-uuid', 
  user_id: 'user-uuid', 
  community_id: null, 
  title: 'Hello world', 
  content: 'Hello world — this is a test post.', 
  created_at: '2026-04-09T12:00:00Z', 
  updated_at: '2026-04-09T12:00:00Z' 
};

export const PostListResponse = {
  type: 'array',
  items: PostResponse
};
PostListResponse.example = [PostResponse.example];

function makePaginatedRootSchema(itemSchema, exampleItem) {
  return {
    type: 'object',
    properties: {
      current_page: { type: 'number' },
      data: { type: 'array', items: itemSchema },
      first_page_url: { type: ['string', 'null'] },
      from: { type: ['number', 'null'] },
      last_page: { type: 'number' },
      last_page_url: { type: ['string', 'null'] },
      links: { type: 'array', items: { type: 'object' } },
      next_page_url: { type: ['string', 'null'] },
      path: { type: 'string' },
      per_page: { type: 'number' },
      prev_page_url: { type: ['string', 'null'] },
      to: { type: ['number', 'null'] },
      total: { type: 'number' }
    },
    example: {
      current_page: 1,
      data: exampleItem ? [exampleItem] : [],
      first_page_url: 'http://localhost:3000/resource?page=1&per_page=20',
      from: 1,
      last_page: 1,
      last_page_url: 'http://localhost:3000/resource?page=1&per_page=20',
      links: [],
      next_page_url: null,
      path: 'http://localhost:3000/resource',
      per_page: 20,
      prev_page_url: null,
      to: 1,
      total: 1
    }
  };
}

export const PostMediaAttachBody = {
  type: 'object',
  required: ['url'],
  properties: { url: { type: 'string' }, mediaType: { type: 'string' }, displayOrder: { type: 'number' } }
};
PostMediaAttachBody.example = { 
  url: 'https://example.com/image.jpg', 
  mediaType: 'image', 
  displayOrder: 0 
};

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
MediaValidationErrorResponse.example = { 
  success: false, 
  error: { 
    code: 'media_not_ready', 
    message: 'One or more media assets are not yet processed', 
    details: [ {
       assetId: 'asset-uuid-123', 
       code: 'file_too_large', 
       message: 'File exceeds 10MB' 
      }, 
      { 
        assetId: 'asset-uuid-456', 
        code: 'unsupported_media_type', 
        message: 'Invalid file format: .exe' 
      } 
    ] 
  } 
};

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
Skill.example = { id: 'skill-uuid', name: 'JavaScript', level: 'expert' };

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
Portfolio.example = { 
  id: 'portfolio-uuid', 
  userId: 'user-uuid', 
  title: 'Personal Website', 
  description: 'Portfolio site', 
  link: 'https://janedoe.dev' 
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
Certification.example = { id: 'cert-uuid', userId: 'user-uuid', name: 'Certified Kubernetes Administrator', issuer: 'CNCF', issueDate: '2021-08-01' };

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
Education.example = { id: 'education-uuid', userId: 'user-uuid', school: 'University of Lagos', degree: 'BSc Computer Science', field: 'Computer Science', startDate: '2015-09-01', endDate: '2019-06-01' };

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
Experience.example = { id: 'experience-uuid', userId: 'user-uuid', company: 'Acme Corp', title: 'Senior Engineer', employmentType: 'full-time', startDate: '2020-01-01', endDate: '2022-12-31', isCurrent: 0, description: 'Worked on backend services and APIs.' };

export const Follower = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    followerId: { type: 'string' },
    followingId: { type: 'string' },
    createdAt: { type: 'string' }
  }
};
Follower.example = { id: 'follow-uuid', followerId: 'user-uuid-2', followingId: 'user-uuid', createdAt: '2026-04-20T09:00:00Z' };

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
OAuthAccount.example = { id: 'oauth-uuid', userId: 'user-uuid', provider: 'google', providerId: 'google-12345', providerEmail: 'user@example.com', avatarUrl: 'https://example.com/avatar.jpg' };

export const UserLoginHistory = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    loginMethod: { type: ['string', 'null'] },
    ipAddress: { type: ['string', 'null'] },
    loginAt: { type: ['string', 'null'], format: 'date-time' }
  }
};
UserLoginHistory.example = { id: 'login-uuid', userId: 'user-uuid', loginMethod: 'email_password', ipAddress: '127.0.0.1', loginAt: '2026-04-23T08:15:00Z' };

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
CommentResponse.example = { id: 'comment-uuid', post_id: 'post-uuid', user_id: 'user-uuid', parent_comment_id: null, content: 'This is really helpful.', created_at: '2026-04-10T12:30:00Z' };

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
PageResponse.example = { id: 'page-uuid', ownerId: 'user-uuid', categoryId: 'page-category-uuid', name: 'My Page', slug: 'my-page', description: 'A public page', avatar: null, coverImage: null, isVerified: 0, isActive: 1, isApproved: 1, approvalNotes: null, approvedAt: '2026-04-20T10:00:00Z', approvedBy: 'admin-uuid', metadata: { theme: 'business' }, followers_count: 12, posts_count: 3, category_pages_count: 25, createdAt: '2026-04-10T09:00:00Z', updatedAt: '2026-04-20T10:00:00Z' };

export const PageListResponse = { type: 'array', items: PageResponse };

export const PageFollower = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    page_id: { type: 'string' },
    user_id: { type: 'string' },
    role: { type: 'string' },
    is_notified: { type: 'number' },
    is_muted: { type: 'number' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    message: { type: ['string', 'null'] }
  }
};
PageFollower.example = { id: 'page-follow-uuid', page_id: 'page-uuid', user_id: 'user-uuid', role: 'follower', is_notified: 1, is_muted: 0, created_at: '2026-04-23T10:00:00Z', updated_at: '2026-04-23T10:00:00Z', message: 'followed' };

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
PageCategoryResponse.example = { id: 'page-category-uuid', name: 'Community', slug: 'community', description: 'Community pages', icon: 'users', is_active: 1, rules: { allowPosting: true }, max_pages_per_user: 5, requires_approval: 1, validation_rules: { slugPattern: '^[a-z0-9-]+$' }, created_at: '2026-04-01T12:00:00Z', updated_at: '2026-04-10T12:00:00Z', total_pages: 12 };

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
CommunityCategoryResponse.example = { id: 'community-category-uuid', name: 'Sports', description: 'Groups for sports fans' };

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
CommunityResponse.example = { id: 'community-uuid', categoryId: 'community-category-uuid', name: 'Local Chess Club', description: 'We meet weekly to play chess', is_active: 1, default_post_visibility: 'community', created_at: '2026-04-12T10:00:00Z' };

export const CommunityMemberResponse = {
  type: 'object',
  properties: { id: { type: 'string' }, userId: { type: 'string' }, communityId: { type: 'string' }, role: { type: 'string' } }
};
CommunityMemberResponse.example = { id: 'membership-uuid', userId: 'user-uuid', communityId: 'community-uuid', role: 'member' };

export const CommentListResponse = { type: 'array', items: CommentResponse };

export const PostPaginatedResponse = makePaginatedRootSchema(PostResponse, PostResponse.example);
export const QuestionPaginatedResponse = makePaginatedRootSchema(QuestionResponse, QuestionResponse.example);
export const AnswerPaginatedResponse = makePaginatedRootSchema(AnswerResponse, AnswerResponse.example);
export const PagePaginatedResponse = makePaginatedRootSchema(PageResponse, PageResponse.example);
export const CommentPaginatedResponse = makePaginatedRootSchema(CommentResponse, CommentResponse.example);
export const PageFollowerPaginatedResponse = makePaginatedRootSchema(PageFollower, PageFollower.example);

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
  RegisterSetPasswordBody,
  ResetPasswordBody,
  RegisterCompleteBody,
  ChangePasswordBody,
  ChangeEmailBody,
  RegisterBody,
  AuthSuccessResponse,
  SimpleSuccessResponse,
  EmptyObjectSuccessResponse,
  EmptyArraySuccessResponse,
  EmailObjectSuccessResponse,
  IdSuccessResponse,
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
  PostPaginatedResponse,
  QuestionPaginatedResponse,
  AnswerPaginatedResponse,
  PagePaginatedResponse,
  CommentPaginatedResponse,
  PageFollowerPaginatedResponse,
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
  PageFollower,
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
  MessageOnlyErrorResponse,
  ValidationErrorResponse,
  Skill,
  Portfolio,
  Certification,
  Education,
  Experience,
  Follower,
  OAuthAccount,
  UserLoginHistory
};
