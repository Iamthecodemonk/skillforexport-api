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

export const UserActivityResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    role: { type: 'string', nullable: true },
    created_at: { type: 'string' },
    updated_at: { type: 'string', nullable: true },
    profile: {
      type: 'object',
      properties: {
        username: { type: 'string', nullable: true },
        displayName: { type: 'string', nullable: true },
        avatar: { type: 'string', nullable: true },
        bio: { type: 'string', nullable: true },
        location: { type: 'string', nullable: true }
      }
    },
    stats: {
      type: 'object',
      properties: {
        posts: { type: 'number' },
        questions: { type: 'number' },
        answers: { type: 'number' },
        comments: { type: 'number' },
        jobs: { type: 'number' },
        jobApplications: { type: 'number' },
        freelanceJobs: { type: 'number' },
        freelanceApplications: { type: 'number' },
        pages: { type: 'number' },
        communities: { type: 'number' },
        ownedCommunities: { type: 'number' },
        skills: { type: 'number' },
        portfolios: { type: 'number' },
        certifications: { type: 'number' },
        education: { type: 'number' },
        experiences: { type: 'number' },
        followers: { type: 'number' },
        totalFollowers: { type: 'number' },
        following: { type: 'number' }
      }
    },
    skills: { type: 'array', items: { type: 'object', additionalProperties: true } },
    portfolios: { type: 'array', items: { type: 'object', additionalProperties: true } },
    certifications: { type: 'array', items: { type: 'object', additionalProperties: true } },
    education: { type: 'array', items: { type: 'object', additionalProperties: true } },
    experiences: { type: 'array', items: { type: 'object', additionalProperties: true } },
    latest: {
      type: 'object',
      properties: {
        post: { type: 'object', nullable: true, additionalProperties: true },
        question: { type: 'object', nullable: true, additionalProperties: true },
        job: { type: 'object', nullable: true, additionalProperties: true },
        freelanceJob: { type: 'object', nullable: true, additionalProperties: true },
        page: { type: 'object', nullable: true, additionalProperties: true }
      }
    }
  }
};
UserActivityResponse.example = {
  id: 'user-uuid',
  email: 'user@example.com',
  role: 'user',
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-02T10:00:00Z',
  profile: { username: 'janedoe', displayName: 'Jane Doe', avatar: null, bio: 'Exporter and product designer', location: 'Lagos' },
  skills: [{ id: 'skill-uuid', skill: 'Export operations', level: 'expert' }],
  portfolios: [{ id: 'portfolio-uuid', title: 'Cocoa export case study', link: 'https://example.com' }],
  certifications: [{ id: 'cert-uuid', name: 'Export Compliance', issuer: 'Trade Institute' }],
  education: [{ id: 'education-uuid', school: 'University of Lagos', degree: 'BSc' }],
  experiences: [{ id: 'experience-uuid', company: 'TradeBridge', title: 'Export Manager' }],
  stats: { posts: 12, questions: 3, answers: 4, comments: 8, jobs: 2, jobApplications: 5, freelanceJobs: 1, freelanceApplications: 2, pages: 1, communities: 3, ownedCommunities: 1, skills: 1, portfolios: 1, certifications: 1, education: 1, experiences: 1, followers: 18, totalFollowers: 18, following: 9 },
  latest: {
    post: { id: 'post-uuid', title: 'Latest update', created_at: '2026-05-10T09:00:00Z' },
    question: { id: 'question-uuid', title: 'How do I export cocoa?', created_at: '2026-05-09T09:00:00Z' },
    job: { id: 'job-uuid', title: 'Export Operations Manager', status: 'live', createdAt: '2026-05-08T09:00:00Z' },
    freelanceJob: null,
    page: { id: 'page-uuid', name: 'Jane Exports', slug: 'jane-exports', createdAt: '2026-05-07T09:00:00Z' }
  }
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
  description: 'Complete registration after OTP verification. Optional onboarding data is persisted into profile, education/experience, and user settings.',
  properties: {
    email: { type: 'string', example: 'user@example.com' },
    name: { type: 'string', example: 'Jane Doe' },
    ref_code: { type: 'string', example: 'ABC123' },
    onboarding: {
      type: 'object',
      additionalProperties: true,
      properties: {
        acceptedTerms: { type: 'boolean' },
        is16OrAbove: { type: 'boolean' },
        state: { type: 'string', example: 'Lagos' },
        country: { type: 'string', example: 'Nigeria' },
        accountType: { type: 'string', enum: ['default', 'student'] },
        jobTitle: { type: 'string', example: 'Product Designer' },
        workplace: { type: 'string', example: 'Skills4Export' },
        university: { type: 'string', example: 'University of Lagos' },
        yearStarted: { type: 'string', example: '2024' },
        courseOfStudy: { type: 'string', example: 'Computer Science' }
      }
    }
  }
};
RegisterCompleteBody.example = { email: 'user@example.com', name: 'Jane Doe', ref_code: 'ABC123', onboarding: { acceptedTerms: true, is16OrAbove: true, state: 'Lagos', country: 'Nigeria', accountType: 'student', university: 'University of Lagos', yearStarted: '2024', courseOfStudy: 'Computer Science' } };

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
    data: {
      type: 'object',
      additionalProperties: true,
      properties: {
        ...AuthTokenResponse.properties,
        user: AuthTokenResponse,
        profile: { type: ['object', 'null'], additionalProperties: true },
        education: { type: 'array', items: { type: 'object', additionalProperties: true } },
        experiences: { type: 'array', items: { type: 'object', additionalProperties: true } },
        settings: { type: ['object', 'null'], additionalProperties: true },
        onboardingCompleted: { type: 'boolean' }
      }
    }
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
    userId: { type: 'string', description: 'Ignored for authenticated requests; backend uses the bearer token user.' },
    communityId: { type: ['string','null'], description: 'Use null or omit for Everyone/public home feed. Use a community id only for community feed posts.' },
    community_id: { type: ['string','null'], description: 'Legacy/request-map alias for communityId.' },
    pageId: { type: ['string','null'], description: 'Optional page id when posting as/under a page.' },
    page_id: { type: ['string','null'], description: 'Legacy/request-map alias for pageId.' },
    title: { type: 'string' },
    content: { type: 'string' },
    visibility: { type: ['string','null'], enum: ['public','connections','community', null], description: 'Optional. Defaults to public for Everyone posts or the community default when communityId is set.' },
    mediaAssetIds: { type: 'array', items: { type: 'string' }, description: 'Optional completed asset ids returned by /media/register. Do not send direct media URLs here.' },
    media_asset_ids: { type: 'array', items: { type: 'string' }, description: 'Legacy/request-map alias for mediaAssetIds.' }
  },
  examples: [
    { summary: 'Everyone / home feed post', value: { communityId: null, title: 'Hello world', content: 'Public home feed post.', mediaAssetIds: ['asset-uuid-123'] } },
    { summary: 'Community feed post', value: { communityId: 'community-uuid', title: 'Community update', content: 'Post shown in this community feed.', mediaAssetIds: [] } }
  ]
};
PostCreateBody.example = { communityId: null, title: 'Hello world', content: 'Hello world - this is a test post.', mediaAssetIds: ['asset-uuid-123'] };

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
    moderation_status: { type: 'string', enum: ['pending','approved','suspended','deleted'] },
    moderationStatus: { type: 'string', enum: ['pending','approved','suspended','deleted'] },
    isClosed: { type: 'boolean' },
    acceptedAnswerId: { type: ['string','null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    user: {
      type: ['object','null'],
      properties: {
        id: { type: 'string' },
        name: { type: ['string','null'] },
        email: { type: ['string','null'] },
        avatar: { type: ['string','null'] },
        avatarUrl: { type: ['string','null'] }
      }
    },
    community: {
      type: ['object','null'],
      properties: {
        id: { type: 'string' },
        name: { type: ['string','null'] },
        description: { type: ['string','null'] }
      }
    },
    score: { type: 'number' },
    is_liked: { type: 'boolean' },
    isLiked: { type: 'boolean' },
    totalAnswers: { type: 'number' },
    totalAnswerers: { type: 'number' },
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
  moderation_status: 'approved',
  moderationStatus: 'approved',
  isClosed: false,
  acceptedAnswerId: null,
  createdAt: '2026-04-01T12:00:00Z',
  updatedAt: '2026-04-01T12:00:00Z',
  user: { id: 'user-uuid', name: 'janedoe', email: 'jane@example.com', avatar: null, avatarUrl: null },
  community: { id: 'community-uuid', name: 'Local Chess Club', description: 'We meet weekly to play chess' },
  score: 3,
  is_liked: false,
  isLiked: false,
  totalAnswers: 1,
  totalAnswerers: 1,
  answers: [
    {
      id: 'a-uuid',
      questionId: 'q-uuid',
      userId: 'user-uuid',
      parentAnswerId: null,
      content: 'This is how...',
      createdAt: '2026-04-01T13:00:00Z',
      updatedAt: '2026-04-01T13:00:00Z',
      user: { id: 'user-uuid', name: 'janedoe', email: 'jane@example.com' }
    }
  ]
};

export const QuestionListResponse = { type: 'array', items: QuestionResponse };

export const AnswerCreateBody = { type: 'object', required: ['content'], properties: { content: { type: 'string' }, parentAnswerId: { type: ['string','null'] }, parent_answer_id: { type: ['string','null'] } } };
AnswerCreateBody.example = { content: 'You can fix it by...' };

export const AnswerResponse = { type: 'object', properties: { id: { type: 'string' }, question_id: { type: 'string' }, questionId: { type: 'string' }, user_id: { type: 'string' }, userId: { type: 'string' }, parent_answer_id: { type: ['string','null'] }, parentAnswerId: { type: ['string','null'] }, content: { type: 'string' }, moderation_status: { type: 'string', enum: ['pending','approved','suspended','deleted'] }, moderationStatus: { type: 'string', enum: ['pending','approved','suspended','deleted'] }, score: { type: 'number' }, is_liked: { type: 'boolean' }, isLiked: { type: 'boolean' }, created_at: { type: 'string' }, createdAt: { type: 'string' }, updated_at: { type: 'string' }, updatedAt: { type: 'string' }, user: { type: ['object','null'], properties: { id: { type: 'string' }, name: { type: ['string','null'] }, email: { type: ['string','null'] }, avatar: { type: ['string','null'] }, avatarUrl: { type: ['string','null'] } } } } };
AnswerResponse.example = { id: 'a-uuid', question_id: 'q-uuid', questionId: 'q-uuid', user_id: 'user-uuid', userId: 'user-uuid', parent_answer_id: null, parentAnswerId: null, content: 'This is how...', moderation_status: 'approved', moderationStatus: 'approved', score: 3, is_liked: false, isLiked: false, created_at: '2026-04-01T13:00:00Z', createdAt: '2026-04-01T13:00:00Z', updated_at: '2026-04-01T13:00:00Z', updatedAt: '2026-04-01T13:00:00Z', user: { id: 'user-uuid', name: 'janedoe', email: 'jane@example.com', avatar: null, avatarUrl: null } };


export const PostResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    user_id: { type: 'string' },
    community_id: { type: 'string', nullable: true },
    page_id: { type: 'string', nullable: true },
    parent_post_id: { type: 'string', nullable: true },
    originalPostId: { type: 'string', nullable: true },
    visibility: { type: 'string' },
    moderation_status: { type: 'string', enum: ['pending','approved','suspended','deleted'] },
    moderationStatus: { type: 'string', enum: ['pending','approved','suspended','deleted'] },
    title: { type: 'string' },
    content: { type: 'string' },
    file_path: { type: 'array', items: { type: 'object', additionalProperties: true } },
    media_path: { type: 'array', items: { type: 'object', additionalProperties: true } },
    images_count: { type: 'number' },
    comment_count: { type: 'number' },
    score: { type: 'number' },
    is_follow: { type: 'boolean' },
    is_liked: { type: 'boolean' },
    is_saved: { type: 'boolean' },
    is_report: { type: 'boolean' },
    type: { type: 'string' },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        avatar: { type: 'string', nullable: true }
      }
    },
    community: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string' },
        name: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        is_active: { type: 'number' },
        default_post_visibility: { type: 'string', nullable: true }
      }
    },
    page: { type: 'object', nullable: true, additionalProperties: true },
    created_at: { type: 'string' },
    updated_at: { type: 'string' }
  }
};
PostResponse.example = { 
  id: 'post-uuid', 
  user_id: 'user-uuid', 
  community_id: null,
  page_id: null,
  parent_post_id: null,
  originalPostId: null,
  visibility: 'public',
  moderation_status: 'approved',
  moderationStatus: 'approved',
  title: 'Hello world', 
  content: 'Hello world — this is a test post.', 
  file_path: [],
  media_path: [],
  images_count: 0,
  comment_count: 2,
  score: 5,
  is_follow: false,
  is_liked: false,
  is_saved: false,
  is_report: false,
  type: 'POST',
  user: { id: 'user-uuid', name: 'janedoe', email: 'jane@example.com', avatar: null },
  community: null,
  page: null,
  created_at: '2026-04-09T12:00:00Z',
  updated_at: '2026-04-09T12:00:00Z' 
};

export const PostListResponse = {
  type: 'array',
  items: PostResponse
};
PostListResponse.example = [PostResponse.example];

export const JobResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    title: { type: 'string' },
    companyName: { type: 'string' },
    companyId: { type: ['string','null'] },
    location: { type: ['string','null'] },
    workMode: { type: ['string','null'], enum: ['remote','hybrid','onsite', null] },
    type: { type: 'string', enum: ['full-time','part-time','contract','hybrid','remote'] },
    salaryMin: { type: ['number','null'] },
    salaryMax: { type: ['number','null'] },
    salaryCurrency: { type: ['string','null'] },
    salaryLabel: { type: ['string','null'] },
    experience: { type: ['string','null'] },
    skills: { type: 'array', items: { type: 'string' } },
    description: { type: ['string','null'] },
    summary: { type: ['string','null'] },
    responsibilities: { type: 'array', items: { type: 'string' } },
    requirements: { type: 'array', items: { type: 'string' } },
    perks: { type: 'array', items: { type: 'string' } },
    applicationEmail: { type: ['string','null'] },
    applicationUrl: { type: ['string','null'] },
    applicationEndDate: { type: ['string','null'] },
    status: { type: 'string', enum: ['draft','pending_review','live','approved','active','closed','archived','deleted','suspended'] },
    applicantCount: { type: 'number' },
    hasApplied: { type: ['boolean','null'] },
    createdByUserId: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};
JobResponse.example = { id: 'job-uuid', slug: 'senior-software-engineer', title: 'Senior Software Engineer', companyName: 'Skills4Export', companyId: null, location: 'Remote', workMode: 'remote', type: 'full-time', salaryMin: 250000, salaryMax: null, salaryCurrency: 'NGN', salaryLabel: null, experience: '2-3', skills: ['JavaScript','Vue'], description: 'Describe the role...', summary: null, responsibilities: [], requirements: ['Qualifications and tasks...'], perks: [], applicationEmail: 'owner@example.com', applicationUrl: null, applicationEndDate: '2026-06-30', status: 'approved', applicantCount: 0, hasApplied: false, createdByUserId: 'user-uuid', createdAt: '2026-05-07T10:00:00Z', updatedAt: '2026-05-07T10:00:00Z' };

export const JobCreateBody = {
  type: 'object',
  required: ['title','companyName','description'],
  properties: {
    title: { type: 'string' },
    skills: {
      description: 'Skills can be sent as an array of strings, an array of selected skill objects, or a comma-separated string.',
      anyOf: [
        { type: 'array', items: { type: 'string' } },
        { type: 'array', items: { type: 'object', additionalProperties: true } },
        { type: 'string' },
        { type: 'null' }
      ]
    },
    location: { type: 'string' },
    type: { type: 'string', enum: ['full-time','part-time','contract','hybrid','remote'] },
    workMode: { type: 'string', enum: ['remote','hybrid','onsite'] },
    senderEmail: { type: 'string' },
    companyName: { type: 'string' },
    company: { type: 'string', description: 'Legacy alias for companyName' },
    description: { type: 'string' },
    qualifications: { type: 'string' },
    tasks: { type: 'string', description: 'Legacy alias mapped to responsibilities' },
    workExperience: { type: 'string' },
    minSalary: { type: 'number' },
    maxSalary: { type: ['number','null'] },
    salaryCurrency: { type: 'string' },
    applicationEndDate: { type: 'string' }
  }
};
JobCreateBody.example = { title: 'Senior Software Engineer', skills: ['JavaScript','Vue'], location: 'Remote', type: 'full-time', senderEmail: 'owner@example.com', companyName: 'Skills4Export', description: 'Describe the role...', qualifications: 'Qualifications and tasks...', workExperience: '2-3', minSalary: 250000, maxSalary: null, salaryCurrency: 'NGN', applicationEndDate: '2026-06-30' };

export const JobApplicationResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    jobId: { type: 'string' },
    userId: { type: 'string' },
    job: { type: ['object','null'], additionalProperties: true },
    coverLetter: { type: ['string','null'] },
    resumeMediaId: { type: ['string','null'] },
    answers: { type: 'array', items: {} },
    status: { type: 'string', enum: ['submitted','reviewing','shortlisted','interview','rejected','accepted','withdrawn'] },
    createdAt: { type: 'string' },
    appliedAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};
JobApplicationResponse.example = { id: 'application-uuid', jobId: 'job-uuid', userId: 'user-uuid', job: null, coverLetter: 'Optional text', resumeMediaId: null, answers: [], status: 'submitted', createdAt: '2026-05-07T10:00:00Z', appliedAt: '2026-05-07T10:00:00Z', updatedAt: '2026-05-07T10:00:00Z' };

export const JobApplicationBody = { type: 'object', properties: { coverLetter: { type: 'string' }, resumeMediaId: { type: 'string', description: 'Uploaded resume media id, URL, or legacy mobile file reference.' }, answers: { type: 'array', items: {} } }, example: { coverLetter: 'Optional text', resumeMediaId: 'media-uuid-or-url', answers: [] } };
export const StatusUpdateBody = {
  type: 'object',
  required: ['status'],
  properties: {
    status: {
      type: 'string',
      description: 'Status value for the target resource. Jobs/freelance jobs become public at `approved`, `active`, or legacy `live`; freelancer profiles become public at `available` or `certified`.'
    }
  },
  examples: [
    { summary: 'Approve job', value: { status: 'approved' } },
    { summary: 'Activate advert', value: { status: 'active' } },
    { summary: 'Approve freelancer', value: { status: 'available' } },
    { summary: 'Move to review', value: { status: 'pending_review' } },
    { summary: 'Suspend', value: { status: 'suspended' } }
  ],
  example: { status: 'approved' }
};

export const JobStatusUpdateBody = {
  type: 'object',
  required: ['status'],
  properties: {
    status: {
      type: 'string',
      enum: ['draft','pending_review','live','approved','active','closed','archived','deleted','suspended'],
      description: '`approved`, `active`, or legacy `live` makes the job visible publicly. `suspended` and `deleted` hide it from public feeds.'
    }
  },
  examples: [
    { summary: 'Approve', value: { status: 'approved' } },
    { summary: 'Suspend', value: { status: 'suspended' } },
    { summary: 'Unsuspend / publish', value: { status: 'approved' } },
    { summary: 'Delete', value: { status: 'deleted' } }
  ],
  example: { status: 'approved' }
};

export const FreelanceJobStatusUpdateBody = {
  type: 'object',
  required: ['status'],
  properties: {
    status: {
      type: 'string',
      enum: ['pending_review','live','approved','active','closed','archived','deleted','suspended'],
      description: '`approved`, `active`, or legacy `live` makes the freelance job visible publicly. `suspended` and `deleted` hide it from public feeds.'
    }
  },
  examples: [
    { summary: 'Approve', value: { status: 'approved' } },
    { summary: 'Suspend', value: { status: 'suspended' } },
    { summary: 'Unsuspend / publish', value: { status: 'approved' } },
    { summary: 'Delete', value: { status: 'deleted' } }
  ],
  example: { status: 'approved' }
};

export const AlertPreferencesResponse = {
  type: 'object',
  properties: {
    contestAlert: { type: 'boolean' },
    sponsorshipAlert: { type: 'boolean' },
    salesAlert: { type: 'boolean' },
    scholarshipType: { type: ['string','null'] },
    scholarship_type: { type: ['string','null'] },
    scholarshipTypes: { type: 'array', items: { type: 'string' } },
    scholarship_types: { type: 'array', items: { type: 'string' } },
    scholarshipTypeOptions: {
      type: 'array',
      items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } }
    },
    scholarship_type_options: {
      type: 'array',
      items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } }
    },
    jobAlert: { type: 'boolean' },
    jobSearchTags: { type: 'array', items: { type: 'string' } },
    jobType: { type: ['string','null'] },
    job_type: { type: ['string','null'] },
    jobTypes: { type: 'array', items: { type: 'string' } },
    job_types: { type: 'array', items: { type: 'string' } },
    employmentTypes: { type: 'array', items: { type: 'string' } },
    employment_types: { type: 'array', items: { type: 'string' } },
    experienceLevel: { type: ['string','null'] },
    experience_level: { type: ['string','null'] },
    experienceLevels: { type: 'array', items: { type: 'string' } },
    experience_levels: { type: 'array', items: { type: 'string' } },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};
AlertPreferencesResponse.example = { contestAlert: true, sponsorshipAlert: true, salesAlert: false, scholarshipType: 'academic_scholarship', scholarship_type: 'academic_scholarship', scholarshipTypes: ['academic_scholarship', 'it_tech_scholarship'], scholarship_types: ['academic_scholarship', 'it_tech_scholarship'], scholarshipTypeOptions: [{ value: 'academic_scholarship', label: 'Academic scholarship' }, { value: 'it_tech_scholarship', label: 'IT/Tech scholarship' }, { value: 'artisan_skills_scholarship', label: 'Artisan skills scholarship' }, { value: 'soft_skills_scholarship', label: 'Soft skills scholarship' }], scholarship_type_options: [{ value: 'academic_scholarship', label: 'Academic scholarship' }, { value: 'it_tech_scholarship', label: 'IT/Tech scholarship' }, { value: 'artisan_skills_scholarship', label: 'Artisan skills scholarship' }, { value: 'soft_skills_scholarship', label: 'Soft skills scholarship' }], jobAlert: true, jobSearchTags: ['Frontend developer'], jobType: 'full-time', job_type: 'full-time', jobTypes: ['full-time', 'remote'], job_types: ['full-time', 'remote'], employmentTypes: ['full-time'], employment_types: ['full-time'], experienceLevel: 'entry', experience_level: 'entry', experienceLevels: ['entry', 'mid'], experience_levels: ['entry', 'mid'], createdAt: '2026-05-07T10:00:00Z', updatedAt: '2026-05-07T10:00:00Z' };
export const AlertPreferencesBody = { type: 'object', properties: { contestAlert: { type: 'boolean' }, sponsorshipAlert: { type: 'boolean' }, salesAlert: { type: 'boolean' }, scholarshipType: { type: ['string','null'] }, scholarship_type: { type: ['string','null'] }, scholarshipTypes: { type: 'array', items: { type: 'string' } }, scholarship_types: { type: 'array', items: { type: 'string' } }, jobAlert: { type: 'boolean' }, jobSearchTags: { type: 'array', items: { type: 'string' }, maxItems: 10 }, jobType: { type: ['string','null'] }, job_type: { type: ['string','null'] }, jobTypes: { type: 'array', items: { type: 'string' } }, job_types: { type: 'array', items: { type: 'string' } }, employmentType: { type: ['string','null'] }, employment_type: { type: ['string','null'] }, employmentTypes: { type: 'array', items: { type: 'string' } }, employment_types: { type: 'array', items: { type: 'string' } }, experienceLevel: { type: ['string','null'] }, experience_level: { type: ['string','null'] }, experienceLevels: { type: 'array', items: { type: 'string' } }, experience_levels: { type: 'array', items: { type: 'string' } } }, example: { contestAlert: true, sponsorshipAlert: true, salesAlert: false, scholarshipTypes: ['academic_scholarship', 'it_tech_scholarship'], jobAlert: true, jobSearchTags: ['Product designer','Frontend developer'], jobTypes: ['full-time', 'remote'], employmentTypes: ['full-time'], experienceLevels: ['entry', 'mid'] } };

export const FreelancerProfileResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    name: { type: 'string' },
    email: { type: ['string','null'], format: 'email' },
    title: { type: 'string' },
    skills: { type: 'array', items: { type: 'string' } },
    location: { type: ['string','null'] },
    bio: { type: ['string','null'] },
    avatar: { type: ['string','null'] },
    passportMediaId: { type: ['string','null'] },
    status: { type: 'string', enum: ['draft','pending_review','available','certified','suspended'] },
    availability: { type: 'string', enum: ['available_now','open','busy','unavailable'] },
    remoteOnly: { type: 'boolean' },
    hourlyRateMin: { type: ['number','null'] },
    hourlyRateMax: { type: ['number','null'] },
    currency: { type: ['string','null'] },
    rating: { type: ['number','null'] },
    completedJobsCount: { type: 'number' },
    user: {
      type: ['object','null'],
      properties: {
        id: { type: 'string' },
        name: { type: ['string','null'] },
        email: { type: ['string','null'], format: 'email' },
        avatar: { type: ['string','null'] }
      }
    },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};
FreelancerProfileResponse.example = { id: 'freelancer-uuid', userId: 'user-uuid', name: 'Samuel Bada', email: 'samuel@example.com', title: 'Software Developer', skills: ['Vue','Node.js'], location: 'Lagos', bio: 'Describe achievements, skills, and experience.', avatar: null, passportMediaId: null, status: 'available', availability: 'available_now', remoteOnly: false, hourlyRateMin: null, hourlyRateMax: null, currency: 'NGN', rating: null, completedJobsCount: 0, user: { id: 'user-uuid', name: 'Samuel Bada', email: 'samuel@example.com', avatar: null }, createdAt: '2026-05-07T10:00:00Z', updatedAt: '2026-05-07T10:00:00Z' };
export const FreelancerCreateBody = { type: 'object', required: ['name','title','skills','location','bio','availability','agreedToTerms'], properties: { name: { type: 'string' }, title: { type: 'string' }, skills: { type: 'array', items: { type: 'string' } }, location: { type: 'string' }, bio: { type: 'string' }, passportMediaId: { type: 'string' }, availability: { type: 'string', enum: ['available_now','open','busy','unavailable'] }, remoteOnly: { type: 'boolean' }, agreedToTerms: { type: 'boolean' } }, example: { name: 'Samuel Bada', title: 'Software Developer', skills: ['Vue','Node.js'], location: 'Lagos', bio: 'Describe achievements, skills, and experience.', passportMediaId: 'media-uuid', availability: 'available_now', remoteOnly: false, agreedToTerms: true } };

export const FreelanceJobResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' }, slug: { type: 'string' }, title: { type: 'string' }, companyName: { type: 'string' }, postedByUserId: { type: 'string' }, location: { type: ['string','null'] }, type: { type: 'string', enum: ['contract','part-time','project-based','remote','hybrid'] }, skills: { type: 'array', items: { type: 'string' } }, description: { type: ['string','null'] }, qualifications: { type: ['string','null'] }, minFee: { type: ['number','null'] }, maxFee: { type: ['number','null'] }, currency: { type: ['string','null'] }, feeLabel: { type: ['string','null'] }, applicationEndDate: { type: ['string','null'] }, status: { type: 'string', enum: ['pending_review','live','approved','active','closed','archived','deleted','suspended'] }, applicantCount: { type: 'number' }, verified: { type: 'boolean' }, hasApplied: { type: ['boolean','null'] }, createdAt: { type: 'string' }, updatedAt: { type: 'string' }
  }
};
FreelanceJobResponse.example = { id: 'freelance-job-uuid', slug: 'web-app-development', title: 'Web App Development', companyName: 'TradeBridge Labs', postedByUserId: 'user-uuid', location: 'Remote', type: 'project-based', skills: ['JavaScript','React'], description: 'I need a full-featured e-commerce web application.', qualifications: 'Frontend and backend experience required.', minFee: 300000, maxFee: 320000, currency: 'NGN', feeLabel: null, applicationEndDate: '2026-06-30', status: 'approved', applicantCount: 0, verified: false, hasApplied: false, createdAt: '2026-05-07T10:00:00Z', updatedAt: '2026-05-07T10:00:00Z' };
export const FreelanceJobCreateBody = { type: 'object', required: ['title','skills','location','type','description','qualifications','companyName','applicationEndDate','agreedToTerms'], properties: { title: { type: 'string' }, skills: { type: 'array', items: { type: 'string' } }, location: { type: 'string' }, type: { type: 'string', enum: ['contract','part-time','project-based','remote','hybrid'] }, description: { type: 'string' }, qualifications: { type: 'string' }, minFee: { type: 'number' }, maxFee: { type: 'number' }, currency: { type: 'string' }, companyName: { type: 'string' }, applicationEndDate: { type: 'string' }, agreedToTerms: { type: 'boolean' } }, example: { title: 'Web App Development', skills: ['JavaScript','React'], location: 'Remote', type: 'project-based', description: 'I need a full-featured e-commerce web application.', qualifications: 'Frontend and backend experience required.', minFee: 300000, maxFee: 320000, currency: 'NGN', companyName: 'TradeBridge Labs', applicationEndDate: '2026-06-30', agreedToTerms: true } };
export const FreelanceApplicationBody = { type: 'object', properties: { proposal: { type: 'string' }, bidAmount: { type: 'number' }, currency: { type: 'string' }, attachmentMediaIds: { type: 'array', items: { type: 'string' } } }, example: { proposal: 'I can deliver this in 3 weeks.', bidAmount: 300000, currency: 'NGN', attachmentMediaIds: [] } };
export const FreelanceApplicationResponse = { type: 'object', properties: { id: { type: 'string' }, freelanceJobId: { type: 'string' }, userId: { type: 'string' }, freelanceJob: { type: ['object','null'], additionalProperties: true }, proposal: { type: ['string','null'] }, bidAmount: { type: ['number','null'] }, currency: { type: ['string','null'] }, attachmentMediaIds: { type: 'array', items: { type: 'string' } }, status: { type: 'string' }, createdAt: { type: 'string' }, appliedAt: { type: 'string' }, updatedAt: { type: 'string' } } };
FreelanceApplicationResponse.example = { id: 'application-uuid', freelanceJobId: 'freelance-job-uuid', userId: 'user-uuid', freelanceJob: null, proposal: 'I can deliver this in 3 weeks.', bidAmount: 300000, currency: 'NGN', attachmentMediaIds: [], status: 'submitted', createdAt: '2026-05-07T10:00:00Z', appliedAt: '2026-05-07T10:00:00Z', updatedAt: '2026-05-07T10:00:00Z' };

export const AdvertLocationResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string','null'] },
    status: { type: 'string', enum: ['active','suspended','deleted'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};
AdvertLocationResponse.example = { id: 'ad-location-uuid', name: 'Feed right sidebar', description: 'Homepage and feed sidebar placement', status: 'active', createdAt: '2026-05-07T10:00:00Z', updatedAt: '2026-05-07T10:00:00Z' };

export const AdvertSiteResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string','null'] },
    status: { type: 'string', enum: ['active','suspended','deleted'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};
AdvertSiteResponse.example = { id: 'ad-site-uuid', name: 'Skills4Export web', description: 'Main web application', status: 'active', createdAt: '2026-05-07T10:00:00Z', updatedAt: '2026-05-07T10:00:00Z' };

export const AdvertOptionCreateBody = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string', enum: ['active','suspended','deleted'] }
  },
  example: { name: 'Feed right sidebar', description: 'Homepage and feed sidebar placement', status: 'active' }
};

export const AdvertResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    locationId: { type: 'string' },
    location: { type: ['object','null'], additionalProperties: true },
    siteId: { type: 'string' },
    site: { type: ['object','null'], additionalProperties: true },
    duration: { type: ['string','number','null'] },
    durationDays: { type: ['number','null'] },
    imageUrl: { type: ['string','null'] },
    imageMediaId: { type: ['string','null'] },
    linkUrl: { type: ['string','null'] },
    ownerName: { type: ['string','null'] },
    ownerPhone: { type: ['string','null'] },
    ownerEmail: { type: ['string','null'] },
    approvedBy: { type: ['string','null'] },
    textAbove: { type: ['string','null'] },
    textBelow: { type: ['string','null'] },
    status: { type: 'string', enum: ['pending_review','approved','active','expired','suspended','deleted'] },
    startsAt: { type: ['string','null'] },
    expiresAt: { type: ['string','null'] },
    isExpired: { type: 'boolean' },
    createdByUserId: { type: ['string','null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};
AdvertResponse.example = { id: 'advert-uuid', locationId: 'ad-location-uuid', location: { id: 'ad-location-uuid', name: 'Feed right sidebar', status: 'active' }, siteId: 'ad-site-uuid', site: { id: 'ad-site-uuid', name: 'Skills4Export web', status: 'active' }, duration: '30 days', durationDays: 30, imageUrl: 'https://res.cloudinary.com/demo/image/upload/ad.png', imageMediaId: null, linkUrl: 'https://example.com', ownerName: 'Acme Exporters', ownerPhone: '+2348012345678', ownerEmail: 'ads@example.com', approvedBy: 'Admin User', textAbove: 'Sponsored', textBelow: 'Export smarter today', status: 'approved', startsAt: '2026-05-07T10:00:00Z', expiresAt: '2026-06-06T10:00:00Z', isExpired: false, createdByUserId: 'admin-user-uuid', createdAt: '2026-05-07T10:00:00Z', updatedAt: '2026-05-07T10:00:00Z' };

export const AdvertCreateBody = {
  type: 'object',
  required: ['locationId','siteId','duration'],
  properties: {
    locationId: { type: 'string' },
    siteId: { type: 'string' },
    duration: { type: ['string','number'] },
    durationDays: { type: 'number' },
    imageUrl: { type: 'string', description: 'Resolved from imageMediaId after media upload; kept for legacy records.' },
    imageMediaId: { type: 'string', description: 'Completed user_assets id from the platform media upload flow.' },
    mediaAssetId: { type: 'string', description: 'Alias for imageMediaId.' },
    imageAssetId: { type: 'string', description: 'Alias for imageMediaId.' },
    mediaPath: { type: 'string', description: 'Legacy alias for imageUrl.' },
    linkUrl: { type: 'string' },
    ownerName: { type: 'string' },
    ownerPhone: { type: 'string' },
    ownerContact: { type: 'string' },
    ownerEmail: { type: 'string' },
    approvedBy: { type: 'string' },
    textAbove: { type: 'string' },
    textBelow: { type: 'string' },
    status: { type: 'string', enum: ['pending_review','approved','active','expired','suspended','deleted'] },
    startsAt: { type: 'string' },
    expiresAt: { type: 'string' }
  },
  example: { locationId: 'ad-location-uuid', siteId: 'ad-site-uuid', duration: '30 days', imageMediaId: 'asset-uuid', linkUrl: 'https://example.com', ownerName: 'Acme Exporters', ownerPhone: '+2348012345678', approvedBy: 'Admin User', textAbove: 'Sponsored', textBelow: 'Export smarter today', status: 'pending_review' }
};

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

  export const PageImageResponse = {
    type: 'object',
    properties: {
      assetId: { type: 'string' },
      id: { type: 'string' },
      url: { type: 'string' },
      publicId: { type: 'string' },
      kind: { type: 'string' },
      title: { type: 'string' },
      mimeType: { type: 'string' },
      sizeBytes: { type: ['number','null'] },
      asset: { type: ['object','null'], additionalProperties: true }
    }
  };
  PageImageResponse.example = { assetId: 'asset-uuid-123', id: 'asset-uuid-123', url: 'https://res.cloudinary.com/.../image.jpg', publicId: 'folder/image', kind: 'page_image', title: 'Header image', mimeType: 'image/jpeg', sizeBytes: 102400, asset: null };

export const UserProfileBody = {
  type: 'object',
  description: 'Profile fields to create or update. Do NOT provide `id` or `userId` — those are generated/derived by the server.',
  properties: {
    username: { type: 'string' },
    displayName: { type: 'string' },
    bio: { type: 'string' },
    location: { type: 'string' },
    avatar: { type: ['string','null'] },
    banner: { type: ['string','null'] },
    website: { type: 'string' },
    linkedin: { type: 'string' },
    github: { type: 'string' },
    currentJobTitle: { type: 'string' },
    current_job_title: { type: 'string' },
    currentWorkspace: { type: 'string' },
    current_workspace: { type: 'string' }
  },
  example: {
    username: 'codemonk',
    displayName: 'Code Monk',
    bio: 'Developer,engineer',
    location: 'Remote',
    website: 'https://example.com',
    linkedin: 'https://linkedin.com/in/tech',
    github: 'https://github.com/tech',
    currentJobTitle: 'Backend Engineer',
    currentWorkspace: 'Skills4Export'
  }
};

export const UserProfileResponse = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Profile record id (server-generated)', readOnly: true },
    userId: { type: 'string', description: 'User id (derived from authenticated token)', readOnly: true },
    username: { type: 'string' },
    displayName: { type: 'string' },
    bio: { type: 'string' },
    location: { type: 'string' },
    avatar: { type: ['string','null'] },
    banner: { type: ['string','null'] },
    website: { type: 'string' },
    linkedin: { type: 'string' },
    github: { type: 'string' },
    currentJobTitle: { type: ['string','null'] },
    current_job_title: { type: ['string','null'] },
    currentWorkspace: { type: ['string','null'] },
    current_workspace: { type: ['string','null'] },
    createdAt: { type: 'string', format: 'date-time' }
  }
};
UserProfileResponse.example = {
  id: 'profile-uuid',
  userId: 'user-uuid',
  username: 'tech',
  displayName: 'Tech User',
  bio: 'Developer',
  location: 'Remote',
  avatar: null,
  banner: null,
  website: 'https://example.com',
  linkedin: 'https://linkedin.com/in/tech',
  github: 'https://github.com/tech',
  currentJobTitle: 'Backend Engineer',
  current_job_title: 'Backend Engineer',
  currentWorkspace: 'Skills4Export',
  current_workspace: 'Skills4Export',
  createdAt: '2026-04-13T00:00:00Z'
};

// Item schemas for FullProfileResponse arrays (defined before FullProfileResponse)
export const Skill = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    skill: { type: 'string' },
    name: { type: 'string', description: 'Alias some clients may use for skill.' },
    userId: { type: 'string' },
    level: { type: 'string', enum: ['beginner', 'intermediate', 'expert'] }
  }
};
Skill.example = { id: 'skill-uuid', userId: 'user-uuid', skill: 'JavaScript', name: 'JavaScript', level: 'expert' };

export const Portfolio = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    link: { type: 'string' },
    pictures: { type: 'array', items: { type: 'string' } }
  }
};
Portfolio.example = { 
  id: 'portfolio-uuid', 
  userId: 'user-uuid', 
  title: 'Personal Website', 
  description: 'Portfolio site', 
  link: 'https://janedoe.dev',
  pictures: ['https://cdn.example.com/portfolio/homepage.png']
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
    createdAt: { type: 'string' },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: ['string','null'] },
        email: { type: ['string','null'] },
        role: { type: ['string','null'] },
        avatar: { type: ['string','null'] }
      }
    }
  }
};
Follower.example = { id: 'follow-uuid', followerId: 'user-uuid-2', followingId: 'user-uuid', createdAt: '2026-04-20T09:00:00Z', user: { id: 'user-uuid-2', name: 'Jane Doe', email: 'jane@example.com', role: 'user', avatar: null } };

export const FollowGroupResponse = {
  type: 'object',
  properties: {
    users: { type: 'array', items: { ...Follower } },
    pages: { type: 'array', items: { type: 'object', additionalProperties: true } },
    totals: { type: 'number' }
  }
};
FollowGroupResponse.example = {
  users: [Follower.example],
  pages: [],
  totals: 1
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
    id: { type: 'string' },
    uuid: { type: 'string' },
    name: { type: ['string','null'] },
    email: { type: 'string' },
    is_admin: { type: 'boolean' },
    profile_image: { type: ['string','null'] },
    location: { type: ['string','null'] },
    bio: { type: ['string','null'] },
    current_job_title: { type: ['string','null'] },
    current_workspace: { type: ['string','null'] },
    notification_email: { type: ['string','null'] },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: ['string','null'] },
        email: { type: 'string' },
        role: { type: 'string' },
        created_at: { type: 'string' }
      }
    },
    profile: { ...UserProfileResponse }, // <--- Use spread
    skills: { type: 'array', items: { ...Skill } }, // <--- Use spread
    educations: { type: 'array', items: { ...Education } },
    portfolios: { type: 'array', items: { ...Portfolio } }, // <--- Use spread
    projects: { type: 'array', items: { ...Portfolio } },
    certifications: { type: 'array', items: { ...Certification } }, // <--- Use spread
    education: { type: 'array', items: { ...Education } }, // <--- Use spread
    experiences: { type: 'array', items: { ...Experience } }, // <--- Use spread
    activeExperiences: { type: 'array', items: { ...Experience } },
    followers: { ...FollowGroupResponse },
    following: { ...FollowGroupResponse },
    followerCount: { type: 'number' },
    followingCount: { type: 'number' },
    oauthAccounts: { type: 'array', items: { ...OAuthAccount } }, // <--- Use spread
    communities: { type: 'array', items: { type: 'object', additionalProperties: true } },
    privacy: {
      type: 'object',
      properties: {
        picture: { type: 'number', enum: [1, 2, 3] },
        country: { type: 'number', enum: [1, 2, 3] },
        biography: { type: 'number', enum: [1, 2, 3] }
      },
      additionalProperties: true
    },
    setting: {
      type: 'object',
      properties: {
        id: { type: ['string','null'] },
        user_id: { type: ['string','null'] },
        feature_and_announcement: { type: 'boolean' },
        featureAndAnnouncement: { type: 'boolean' },
        mails: { type: 'boolean' },
        tips_and_reminders: { type: 'boolean' },
        tipsAndReminders: { type: 'boolean' },
        inbox: { type: 'boolean' },
        research: { type: 'boolean' },
        recommended: { type: 'boolean' },
        alerts: { type: 'boolean' },
        profile: { type: 'boolean' },
        privacy: {
          type: 'object',
          properties: {
            picture: { type: 'number', enum: [1, 2, 3] },
            country: { type: 'number', enum: [1, 2, 3] },
            biography: { type: 'number', enum: [1, 2, 3] }
          },
          additionalProperties: true
        },
        created_at: { type: ['string','null'] },
        updated_at: { type: ['string','null'] }
      }
    },
    settings: {
      type: 'object',
      description: 'Alias of setting for newer clients. This is flat and does not contain another settings object.',
      additionalProperties: true
    },
    counts: {
      type: 'object',
      properties: {
        pages: { type: 'number' },
        communities: { type: 'number' },
        posts: { type: 'number' },
        questions: { type: 'number' },
        comments: { type: 'number' },
        answers: { type: 'number' }
      }
    },
    metrics: {
      type: 'object',
      description: 'Alias of counts for clients that label profile totals as metrics.',
      properties: {
        pages: { type: 'number' },
        communities: { type: 'number' },
        posts: { type: 'number' },
        questions: { type: 'number' },
        comments: { type: 'number' },
        answers: { type: 'number' }
      }
    },
    scores: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        byCommunity: { type: 'array', items: { type: 'object', additionalProperties: true } }
      }
    },
    alerts: {
      type: 'object',
      properties: {
        contest_alert: { type: 'boolean' },
        sales_alert: { type: 'boolean' },
        scholarship_types: { type: 'array', items: { type: 'string' } },
        job_experience: { type: ['string','null'] },
        job_tags: { type: 'array', items: { type: 'string' } },
        job_types: { type: 'array', items: { type: 'string' } }
      }
    },
    created_at: { type: ['string','null'] },
    created_at_human: { type: ['string','null'] },
    referral_code: { type: ['string','null'] }
  }
};

export const UserPrivacyBody = {
  type: 'object',
  properties: {
    picture: { type: 'number', enum: [1, 2, 3], description: '1=public, 2=followers only, 3=only me' },
    country: { type: 'number', enum: [1, 2, 3], description: '1=public, 2=followers only, 3=only me' },
    biography: { type: 'number', enum: [1, 2, 3], description: '1=public, 2=followers only, 3=only me' }
  },
  additionalProperties: true,
  example: {
    picture: 1,
    country: 1,
    biography: 2
  }
};

export const UserPrivacyGetResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string', example: 'Privacy settings fetched successfully' },
    data: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        privacy: UserPrivacyBody,
        picture: { type: 'number', enum: [1, 2, 3] },
        country: { type: 'number', enum: [1, 2, 3] },
        biography: { type: 'number', enum: [1, 2, 3] }
      },
      additionalProperties: true
    }
  }
};

export const UserPrivacyUpdateResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string', example: 'Privacy settings updated successfully' },
    data: { type: 'array', items: {}, example: [] }
  },
  example: {
    success: true,
    message: 'Privacy settings updated successfully',
    data: []
  }
};

export const UserSettingsBody = {
  type: 'object',
  properties: {
    feature_and_announcement: { type: 'boolean' },
    mails: { type: 'boolean' },
    tips_and_reminders: { type: 'boolean' },
    inbox: { type: 'boolean' },
    comments: { type: 'boolean' },
    replies: { type: 'boolean' },
    answers: { type: 'boolean' },
    scoresAndReactions: { type: 'boolean' },
    scores_and_reactions: { type: 'boolean' },
    follows: { type: 'boolean' },
    research: { type: 'boolean' },
    recommended: { type: 'boolean' },
    recommendedJobs: { type: 'boolean' },
    recommended_jobs: { type: 'boolean' },
    alerts: { type: 'boolean' },
    pageActivity: { type: 'boolean' },
    page_activity: { type: 'boolean' },
    featuresAndAnnouncements: { type: 'boolean' },
    features_and_announcements: { type: 'boolean' },
    emailNotifications: { type: 'boolean' },
    email_notifications: { type: 'boolean' },
    updates: { type: 'object', additionalProperties: { type: 'boolean' } },
    notificationPreferences: { type: 'object', additionalProperties: { type: 'boolean' } }
  },
  additionalProperties: true,
  example: {
    feature_and_announcement: true,
    mails: true,
    tips_and_reminders: false,
    inbox: true,
    comments: true,
    replies: true,
    answers: true,
    scoresAndReactions: true,
    follows: true,
    research: true,
    recommended: true,
    alerts: true,
    pageActivity: true,
    featuresAndAnnouncements: true,
    emailNotifications: false
  }
};

export const UserSettingsResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string', example: 'Settings updated successfully' },
    data: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        feature_and_announcement: { type: 'boolean' },
        mails: { type: 'boolean' },
        tips_and_reminders: { type: 'boolean' },
        inbox: { type: 'boolean' },
        comments: { type: 'boolean' },
        replies: { type: 'boolean' },
        answers: { type: 'boolean' },
        scoresAndReactions: { type: 'boolean' },
        scores_and_reactions: { type: 'boolean' },
        follows: { type: 'boolean' },
        research: { type: 'boolean' },
        recommended: { type: 'boolean' },
        recommendedJobs: { type: 'boolean' },
        recommended_jobs: { type: 'boolean' },
        alerts: { type: 'boolean' },
        pageActivity: { type: 'boolean' },
        page_activity: { type: 'boolean' },
        featuresAndAnnouncements: { type: 'boolean' },
        features_and_announcements: { type: 'boolean' },
        emailNotifications: { type: 'boolean' },
        email_notifications: { type: 'boolean' },
        updates: { type: 'object', additionalProperties: { type: 'boolean' } },
        notificationPreferences: { type: 'object', additionalProperties: { type: 'boolean' } }
      },
      additionalProperties: true
    }
  },
  example: {
    success: true,
    message: 'Settings updated successfully',
    data: {
      user_id: 'user-id',
      inbox: true,
      alerts: true,
      mails: false,
      emailNotifications: false,
      comments: true,
      replies: true,
      answers: true,
      scoresAndReactions: true,
      follows: true,
      research: true,
      recommendedJobs: true,
      pageActivity: true,
      featuresAndAnnouncements: true,
      updates: {
        inbox: true,
        alerts: true,
        emailNotifications: false,
        comments: true,
        replies: true,
        answers: true,
        scoresAndReactions: true,
        follows: true,
        research: true,
        recommendedJobs: true,
        pageActivity: true,
        featuresAndAnnouncements: true
      }
    }
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
  properties: { imageUrl: { type: 'string' }, publicId: { type: 'string' } },
  anyOf: [{ required: ['imageUrl'] }, { required: ['publicId'] }],
  example: { imageUrl: 'https://example.com/photo.jpg' }
};

export const UserUpdateBody = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    displayName: { type: 'string' }
  },
  example: { name: 'Arden Smith' }
};

export const UserUpdateResponse = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      }
    },
    profile: UserProfileResponse
  }
};

export const PublicProfileResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string', nullable: true },
    displayName: { type: 'string', nullable: true },
    username: { type: 'string', nullable: true },
    avatar: { type: 'string', nullable: true },
    bio: { type: 'string', nullable: true },
    location: { type: 'string', nullable: true },
    skills: { type: 'array', items: { type: 'object', additionalProperties: true } },
    education: { type: 'array', items: { type: 'object', additionalProperties: true } },
    experiences: { type: 'array', items: { type: 'object', additionalProperties: true } },
    portfolios: { type: 'array', items: { type: 'object', additionalProperties: true } },
    posts: { type: 'array', items: { type: 'object', additionalProperties: true } },
    scoreTotals: {
      type: 'object',
      properties: { posts: { type: 'number' }, comments: { type: 'number' }, questions: { type: 'number' }, answers: { type: 'number' }, total: { type: 'number' } }
    },
    counts: {
      type: 'object',
      properties: { posts: { type: 'number' }, questions: { type: 'number' }, comments: { type: 'number' }, answers: { type: 'number' } }
    },
    followerCount: { type: 'number' }
  }
};

export const MediaRegisterBody = {
  type: 'object',
  required: ['publicId'],
  properties: {
    publicId: { type: 'string', description: 'Cloudinary public id returned after direct upload.' },
    title: { type: ['string','null'], description: 'Optional display title for the uploaded media.' },
    kind: { type: 'string', enum: ['image','video','avatar','banner','post_image','advert_image','document','other'], description: 'Use image/video for page or personal uploads. Existing avatar/banner/advert kinds are still supported.' },
    replace: { type: 'boolean' },
    pageId: { type: ['string','null'], description: 'Set for page-owned media uploads.' },
    page_id: { type: ['string','null'], description: 'Snake-case alias for pageId.' },
    userId: { type: ['string','null'], description: 'Set for personal/profile uploads. Defaults to authenticated user when omitted.' },
    user_id: { type: ['string','null'], description: 'Snake-case alias for userId.' }
  },
  examples: [
    { summary: 'Page image upload', value: { publicId: 'pages/femi/photo1', title: 'Upload title', kind: 'image', pageId: 'page-id' } },
    { summary: 'Personal video upload', value: { publicId: 'users/user-id/video1', title: 'Upload title', kind: 'video', userId: 'user-id' } }
  ],
  example: { publicId: 'pages/femi/photo1', title: 'Upload title', kind: 'image', pageId: 'page-id' }
};

export const JobAcceptedResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: { jobId: { type: 'string' }, assetId: { type: 'string' } } }
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
  properties: { userId: { type: 'string' }, content: { type: 'string' }, parentCommentId: { type: ['string','null'] }, parent_comment_id: { type: ['string','null'] } }
};

export const CommentResponse = {
  type: 'object',
  properties: { id: { type: 'string' }, post_id: { type: 'string' }, postId: { type: 'string' }, user_id: { type: 'string' }, userId: { type: 'string' }, parent_comment_id: { type: ['string','null'] }, parentCommentId: { type: ['string','null'] }, content: { type: 'string' }, moderation_status: { type: 'string', enum: ['pending','approved','suspended','deleted'] }, moderationStatus: { type: 'string', enum: ['pending','approved','suspended','deleted'] }, score: { type: 'number' }, is_liked: { type: 'boolean' }, isLiked: { type: 'boolean' }, is_report: { type: 'boolean' }, isReport: { type: 'boolean' }, created_at: { type: 'string' }, createdAt: { type: 'string' }, updated_at: { type: 'string' }, updatedAt: { type: 'string' }, user: { type: ['object','null'], properties: { id: { type: 'string' }, name: { type: ['string','null'] }, email: { type: ['string','null'] }, avatar: { type: ['string','null'] }, avatarUrl: { type: ['string','null'] } } } }
};
CommentResponse.example = { id: 'comment-uuid', post_id: 'post-uuid', postId: 'post-uuid', user_id: 'user-uuid', userId: 'user-uuid', parent_comment_id: null, parentCommentId: null, content: 'This is really helpful.', moderation_status: 'approved', moderationStatus: 'approved', score: 2, is_liked: false, isLiked: false, is_report: false, isReport: false, created_at: '2026-04-10T12:30:00Z', createdAt: '2026-04-10T12:30:00Z', updated_at: '2026-04-10T12:30:00Z', updatedAt: '2026-04-10T12:30:00Z', user: { id: 'user-uuid', name: 'janedoe', email: 'jane@example.com', avatar: null, avatarUrl: null } };

export const PageCreateBody = {
  type: 'object',
  required: ['name','slug'],
  properties: {
    type: { type: 'string', enum: ['business', 'student'], description: 'Page type. New clients should always send this.' },
    pageType: { type: 'string', enum: ['business', 'student'], description: 'Alias for type.' },
    page_type: { type: 'string', enum: ['business', 'student'], description: 'Snake-case alias for type.' },
    categoryId: { type: ['string','null'] },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    avatar: { type: ['string','null'] },
    coverImage: { type: ['string','null'] },
    slogan: { type: 'string', description: 'Business page metadata shortcut.' },
    contactEmail: { type: 'string', format: 'email', description: 'Business page metadata shortcut.' },
    website: { type: 'string', description: 'Business page metadata shortcut.' },
    staffSize: { type: 'string', description: 'Business page metadata shortcut.' },
    businessCategory: { type: 'string', description: 'Business page metadata shortcut.' },
    email: { type: 'string', format: 'email', description: 'Student page metadata shortcut.' },
    phone: { type: 'string', description: 'Student page metadata shortcut.' },
    courseOfStudy: { type: 'string', description: 'Student page metadata shortcut.' },
    graduationDate: { type: 'string', format: 'date', description: 'Student page metadata shortcut.' },
    skills: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }], description: 'Student page metadata shortcut.' },
    metadata: {
      type: ['object','null'],
      additionalProperties: true,
      properties: {
        slogan: { type: 'string' },
        contactEmail: { type: 'string', format: 'email' },
        website: { type: 'string' },
        staffSize: { type: 'string' },
        businessCategory: { type: 'string' },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string' },
        courseOfStudy: { type: 'string' },
        graduationDate: { type: 'string', format: 'date' },
        skills: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] }
      }
    }
  },
  examples: [
    {
      summary: 'Business page',
      value: {
        type: 'business',
        name: 'Ben Confectioneries',
        slug: 'ben-confectioneries',
        description: '<p>Business description</p>',
        metadata: {
          slogan: 'Cooking Up Love',
          contactEmail: 'business@email.com',
          website: 'https://example.com',
          staffSize: '1-10',
          businessCategory: 'Information Technology'
        }
      }
    },
    {
      summary: 'Student page',
      value: {
        type: 'student',
        name: 'Sunday Godswill',
        slug: 'sunday-godswill',
        description: '<p>Student about text</p>',
        metadata: {
          email: 'student@email.com',
          phone: '+234 000 000 0000',
          courseOfStudy: 'Computer Science',
          graduationDate: '2026-05-26',
          skills: ['C++', 'JavaScript']
        }
      }
    }
  ],
  example: {
    type: 'student',
    name: 'Sunday Godswill',
    slug: 'sunday-godswill',
    description: '<p>Student about text</p>',
    metadata: { courseOfStudy: 'Computer Science', graduationDate: '2026-05-26', skills: ['C++', 'JavaScript'] }
  }
};

export const PagePrefillResponse = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['business', 'student'] },
    pageType: { type: 'string', enum: ['business', 'student'] },
    name: { type: ['string','null'] },
    email: { type: ['string','null'] },
    phone: { type: ['string','null'] },
    courseOfStudy: { type: ['string','null'] },
    skills: { type: 'array', items: { type: 'string' } },
    contactEmail: { type: ['string','null'] },
    website: { type: ['string','null'] },
    businessCategory: { type: ['string','null'] },
    avatar: { type: ['string','null'] }
  }
};
PagePrefillResponse.example = { type: 'student', pageType: 'student', name: 'Sunday Godswill', email: 'student@email.com', phone: '+234 000 000 0000', courseOfStudy: 'Computer Science', skills: ['C++', 'JavaScript'], avatar: 'https://example.com/avatar.jpg' };

export const PageCategoryCreateBody = {
  type: 'object',
  required: ['name','slug'],
  properties: {
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    icon: { type: 'string' },
    is_active: { type: 'number' },
    rules: { type: 'object', nullable: true },
    max_pages_per_user: { type: 'number', nullable: true },
    requires_approval: { type: 'number', nullable: true },
    validation_rules: { type: 'object', nullable: true }
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
    owner_id: { type: 'string' },
    ownerId: { type: 'string' },
    page_type: { type: 'string', enum: ['business', 'student'] },
    type: { type: 'string', enum: ['business', 'student'] },
    pageType: { type: 'string', enum: ['business', 'student'] },
    categoryId: { type: ['string','null'] },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    avatar: { type: ['string','null'] },
    cover_image: { type: ['string','null'] },
    coverImage: { type: ['string','null'] },
    isVerified: { type: 'number' },
    isActive: { type: 'number' },
    isApproved: { type: 'number' },
    moderation_status: { type: 'string', enum: ['pending','approved','suspended','deleted'] },
    moderationStatus: { type: 'string', enum: ['pending','approved','suspended','deleted'] },
    approvalNotes: { type: ['string','null'] },
    approvedAt: { type: ['string','null'] },
    approvedBy: { type: ['string','null'] },
    metadata: { type: ['object','null'] },
    slogan: { type: ['string','null'], description: 'Business page metadata shortcut mirrored from metadata.slogan.' },
    contactEmail: { type: ['string','null'], description: 'Business page metadata shortcut mirrored from metadata.contactEmail.' },
    website: { type: ['string','null'], description: 'Business page metadata shortcut mirrored from metadata.website.' },
    staffSize: { type: ['string','null'], description: 'Business page metadata shortcut mirrored from metadata.staffSize.' },
    businessCategory: { type: ['string','null'], description: 'Business page metadata shortcut mirrored from metadata.businessCategory.' },
    email: { type: ['string','null'], description: 'Student page metadata shortcut mirrored from metadata.email.' },
    phone: { type: ['string','null'], description: 'Student page metadata shortcut mirrored from metadata.phone.' },
    courseOfStudy: { type: ['string','null'], description: 'Student page metadata shortcut mirrored from metadata.courseOfStudy.' },
    graduationDate: { type: ['string','null'], description: 'Student page metadata shortcut mirrored from metadata.graduationDate.' },
    skills: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }, { type: 'null' }], description: 'Student page metadata shortcut mirrored from metadata.skills.' },
    followers_count: { type: ['number','null'], description: 'Number of followers for the page (optional; present if calculated/denormalized)' },
    posts_count: { type: ['number','null'], description: 'Denormalized post count for the page (optional; present when the pages table maintains a post_count column)' },
    category_pages_count: { type: ['number','null'], description: 'Total pages in the page category (optional; present if counted)' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  }
};
PageResponse.example = { id: 'page-uuid', ownerId: 'user-uuid', page_type: 'student', type: 'student', pageType: 'student', categoryId: 'page-category-uuid', name: 'Sunday Godswill', slug: 'sunday-godswill', description: '<p>Student about text</p>', avatar: null, cover_image: null, coverImage: null, isVerified: 0, isActive: 1, isApproved: 1, moderation_status: 'approved', moderationStatus: 'approved', approvalNotes: null, approvedAt: '2026-04-20T10:00:00Z', approvedBy: 'admin-uuid', metadata: { courseOfStudy: 'Computer Science', graduationDate: '2026-05-26', skills: ['C++', 'JavaScript'] }, followers_count: 12, posts_count: 3, category_pages_count: 25, createdAt: '2026-04-10T09:00:00Z', updatedAt: '2026-04-20T10:00:00Z' };

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
    icon: { type: 'string', nullable: true },
    is_active: { type: 'number' },
    rules: { type: 'object', nullable: true },
    max_pages_per_user: { type: 'number', nullable: true },
    requires_approval: { type: 'number', nullable: true },
    validation_rules: { type: 'object', nullable: true },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    total_pages: { type: 'number', nullable: true, description: 'On GET /page-categories this is the authenticated user page count in the category. On GET /page-categories/all this is the global page count in the category.' }
  }
};
PageCategoryResponse.example = { id: 'page-category-uuid', name: 'Student', slug: 'student', description: 'Student pages', icon: 'graduation-cap', is_active: 1, rules: { allowPosting: true }, max_pages_per_user: 1, requires_approval: 1, validation_rules: { slugPattern: '^[a-z0-9-]+$' }, created_at: '2026-04-01T12:00:00Z', updated_at: '2026-04-10T12:00:00Z', total_pages: 1 };

export const CommunityCategoryCreateBody = {
  type: 'object',
  required: ['name'],
  properties: { name: { type: 'string' }, description: { type: 'string' } },
  example: { name: 'Sports', description: 'Groups for sports fans' }
};

export const CommunityCategoryResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    total_communities: { type: 'number', description: 'Total number of communities under this category' }
  }
};
CommunityCategoryResponse.example = { id: 'community-category-uuid', name: 'Sports', description: 'Groups for sports fans', total_communities: 8 };

export const CommunityCreateBody = {
  type: 'object',
  required: ['name'],
  properties: { name: { type: 'string' }, icon: { type: 'string', description: 'Line Awesome icon class/name, for example `las la-users` or `la-users`.' }, description: { type: 'string' }, categoryId: { type: 'string' }, defaultPostVisibility: { type: 'string', enum: ['public','connections','community'] }, isPrivate: { type: 'boolean', description: 'When true, community posts default to visibility=community and stay inside the community.' }, is_private: { type: 'number', enum: [0, 1], description: 'Database/legacy alias for isPrivate.' }, onlyAdmin: { type: 'boolean', description: 'When true, only platform admins/community admins can post; posts from this community cannot be shared to another community.' }, only_admin: { type: 'number', enum: [0, 1], description: 'Database/legacy alias for onlyAdmin.' }, membersOnlyPosting: { type: 'boolean', description: 'When true, only community members can post. When false, any authenticated user can post in the community.' }, members_only_posting: { type: 'number', enum: [0, 1], description: 'Legacy/database alias for membersOnlyPosting.' } },
  example: { name: 'Local Chess Club', icon: 'las la-chess', description: 'We meet weekly to play chess', categoryId: null, defaultPostVisibility: 'public', isPrivate: false, onlyAdmin: false, membersOnlyPosting: false }
};

export const CommunityUpdateBody = {
  type: 'object',
  properties: { name: { type: 'string' }, icon: { type: 'string', description: 'Line Awesome icon class/name, for example `las la-users` or `la-users`.' }, description: { type: 'string' }, defaultPostVisibility: { type: 'string', enum: ['public','connections','community'] }, isPrivate: { type: 'boolean', description: 'When true, community posts default to visibility=community and stay inside the community.' }, is_private: { type: 'number', enum: [0, 1], description: 'Database/legacy alias for isPrivate.' }, onlyAdmin: { type: 'boolean', description: 'When true, only platform admins/community admins can post; posts from this community cannot be shared to another community.' }, only_admin: { type: 'number', enum: [0, 1], description: 'Database/legacy alias for onlyAdmin.' }, membersOnlyPosting: { type: 'boolean', description: 'When true, only community members can post. When false, any authenticated user can post in the community.' }, members_only_posting: { type: 'number', enum: [0, 1], description: 'Legacy/database alias for membersOnlyPosting.' }, is_active: { type: 'number' } },
  example: { name: 'Chess Club', icon: 'las la-chess', description: 'Updated desc', defaultPostVisibility: 'community', isPrivate: true, onlyAdmin: false, membersOnlyPosting: false, is_active: 1 }
};

export const CommunityResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    categoryId: { type: ['string','null'] },
    category_id: { type: ['string','null'] },
    category: {
      type: ['object','null'],
      description: 'Community category this community belongs to. Present on GET /communities list results.',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      }
    },
    name: { type: 'string' },
    icon: { type: ['string','null'], description: 'Line Awesome icon class/name stored for frontend rendering.' },
    description: { type: 'string' },
    is_active: { type: 'number' },
    members_only_posting: { type: 'number', enum: [0, 1], description: '1 means only community members can post; 0 means any authenticated user can post.' },
    membersOnlyPosting: { type: 'boolean', description: 'Boolean form of members_only_posting.' },
    default_post_visibility: { type: ['string','null'], description: 'Default visibility for new posts in this community' },
    is_private: { type: 'number', enum: [0, 1], description: '1 means posts default to visibility=community and stay inside the community.' },
    isPrivate: { type: 'boolean', description: 'Boolean form of is_private.' },
    only_admin: { type: 'number', enum: [0, 1], description: '1 means only platform/community admins can post and posts cannot be shared to another community.' },
    onlyAdmin: { type: 'boolean', description: 'Boolean form of only_admin.' },
    posts_count: { type: 'number', description: 'Total number of posts under this community' },
    post_likes_count: { type: 'number', description: 'Total number of like reactions on posts under this community' },
    post_reactions_count: { type: 'number', description: 'Total number of all post reactions under this community' },
    comments_count: { type: 'number', description: 'Total number of comments on posts under this community' },
    created_at: { type: 'string' }
  }
};
CommunityResponse.example = { id: 'community-uuid', categoryId: 'community-category-uuid', category_id: 'community-category-uuid', category: { id: 'community-category-uuid', name: 'Sports' }, name: 'Local Chess Club', icon: 'las la-chess', description: 'We meet weekly to play chess', is_active: 1, members_only_posting: 0, membersOnlyPosting: false, default_post_visibility: 'community', is_private: 1, isPrivate: true, only_admin: 0, onlyAdmin: false, posts_count: 24, post_likes_count: 41, post_reactions_count: 58, comments_count: 103, created_at: '2026-04-12T10:00:00Z' };

export const CommunityMemberResponse = {
  type: 'object',
  properties: { id: { type: 'string' }, userId: { type: 'string' }, communityId: { type: 'string' }, role: { type: 'string' } }
};
CommunityMemberResponse.example = { id: 'membership-uuid', userId: 'user-uuid', communityId: 'community-uuid', role: 'member' };

export const CommentListResponse = { type: 'array', items: CommentResponse };

export const PostPaginatedResponse = makePaginatedRootSchema(PostResponse, PostResponse.example);
export const UserActivityPaginatedResponse = makePaginatedRootSchema(UserActivityResponse, UserActivityResponse.example);
export const QuestionPaginatedResponse = makePaginatedRootSchema(QuestionResponse, QuestionResponse.example);
export const AnswerPaginatedResponse = makePaginatedRootSchema(AnswerResponse, AnswerResponse.example);
export const PagePaginatedResponse = makePaginatedRootSchema(PageResponse, PageResponse.example);
export const PageCategoryPaginatedResponse = makePaginatedRootSchema(PageCategoryResponse, PageCategoryResponse.example);
export const CommentPaginatedResponse = makePaginatedRootSchema(CommentResponse, CommentResponse.example);
export const PageFollowerPaginatedResponse = makePaginatedRootSchema(PageFollower, PageFollower.example);
export const CommunityPaginatedResponse = makePaginatedRootSchema(CommunityResponse, CommunityResponse.example);
export const JobPaginatedResponse = makePaginatedRootSchema(JobResponse, JobResponse.example);
export const JobApplicationPaginatedResponse = makePaginatedRootSchema(JobApplicationResponse, JobApplicationResponse.example);
export const FreelancerPaginatedResponse = makePaginatedRootSchema(FreelancerProfileResponse, FreelancerProfileResponse.example);
export const FreelanceJobPaginatedResponse = makePaginatedRootSchema(FreelanceJobResponse, FreelanceJobResponse.example);
export const FreelanceApplicationPaginatedResponse = makePaginatedRootSchema(FreelanceApplicationResponse, FreelanceApplicationResponse.example);
export const AdvertPaginatedResponse = makePaginatedRootSchema(AdvertResponse, AdvertResponse.example);
export const AdvertLocationPaginatedResponse = makePaginatedRootSchema(AdvertLocationResponse, AdvertLocationResponse.example);
export const AdvertSitePaginatedResponse = makePaginatedRootSchema(AdvertSiteResponse, AdvertSiteResponse.example);

export const ReactionBody = {
  type: 'object',
  properties: { userId: { type: 'string' }, type: { type: 'string', enum: ['like','love','clap','dislike'], example: 'like' } }
};

export const ReactionToggleResponse = {
  type: 'object',
  properties: {
    result: { type: 'object' },
    count: { type: 'number' },
    score: { type: 'number' },
    is_liked: { type: 'boolean' },
    isLiked: { type: 'boolean' },
    item: { type: 'object', additionalProperties: true, description: 'Updated feed-style item after the reaction toggle.' },
    post: { type: 'object', additionalProperties: true, description: 'Alias of item for post reactions.' }
  },
  example: {
    result: { action: 'created', type: 'like' },
    count: 12,
    score: 12,
    is_liked: true,
    isLiked: true,
    item: { type: 'post', id: 'post-uuid', score: 12, is_liked: true, viewerState: { isScored: true } },
    post: { type: 'post', id: 'post-uuid', score: 12, is_liked: true, viewerState: { isScored: true } }
  }
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

export const CommentReportResponse = {
  type: 'object',
  properties: { id: { type: 'string' }, comment_id: { type: 'string' }, user_id: { type: 'string' }, reason: { type: 'string' }, details: { type: 'string' }, created_at: { type: 'string' } }
};

export const PostShareBody = {
  type: 'object',
  properties: {
    communityId: { type: 'string' },
    community_id: { type: 'string' },
    comment: { type: 'string' }
  },
  example: { communityId: 'community-uuid', comment: 'My thoughts on this post' }
};

export const PostShareResponse = {
  type: 'object',
  properties: {
    ...PostResponse.properties,
    originalPostId: { type: 'string' },
    communityId: { type: 'string' },
    comment: { type: 'string' },
    createdAt: { type: 'string' }
  }
};

export const PostShareEventBody = {
  type: 'object',
  properties: { type: { type: 'string', example: 'copy_link' } },
  example: { type: 'copy_link' }
};

export const PostShareEventResponse = {
  type: 'object',
  properties: {
    postId: { type: 'string' },
    userId: { type: 'string' },
    type: { type: 'string' },
    recorded: { type: 'boolean' },
    createdAt: { type: 'string' }
  }
};

export const JobShareBody = {
  type: 'object',
  properties: {
    type: { type: 'string', example: 'copy_link' },
    url: { type: 'string' }
  },
  example: { type: 'copy_link' }
};

export const JobShareResponse = {
  type: 'object',
  properties: {
    jobId: { type: 'string' },
    userId: { type: ['string','null'] },
    type: { type: 'string' },
    url: { type: 'string' },
    title: { type: ['string','null'] },
    recorded: { type: 'boolean' },
    createdAt: { type: 'string' }
  }
};

export const JobShareEventResponse = {
  type: 'object',
  properties: {
    jobId: { type: 'string' },
    userId: { type: ['string','null'] },
    type: { type: 'string' },
    recorded: { type: 'boolean' },
    createdAt: { type: 'string' }
  }
};

export const JobReferBody = {
  type: 'object',
  required: ['email'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', description: 'One email or comma-separated emails.', example: 'friend@example.com, teammate@example.com' }
  },
  example: { email: 'friend@example.com, teammate@example.com' }
};

export const JobReferResponse = {
  type: 'object',
  properties: {
    jobId: { type: 'string' },
    userId: { type: ['string','null'] },
    emails: { type: 'array', items: { type: 'string' } },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          sent: { type: 'boolean' },
          skipped: { type: 'boolean' },
          reason: { type: ['string','null'] }
        }
      }
    },
    url: { type: 'string' },
    referred: { type: 'boolean' },
    createdAt: { type: 'string' }
  }
};

export const LegalDocumentResponse = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    contentType: { type: 'string', enum: ['html', 'markdown', 'plain_text'] },
    version: { type: 'string' },
    status: { type: 'string', enum: ['draft', 'published', 'archived'] },
    effectiveDate: { type: ['string', 'null'] },
    publishedAt: { type: ['string', 'null'] },
    createdAt: { type: ['string', 'null'] },
    updatedAt: { type: ['string', 'null'] }
  },
  example: {
    id: 'legal-doc-uuid',
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    content: '<p>Privacy policy content...</p>',
    contentType: 'html',
    version: '1.0',
    status: 'published',
    effectiveDate: '2026-06-04',
    publishedAt: '2026-06-04T10:00:00Z',
    createdAt: '2026-06-04T10:00:00Z',
    updatedAt: '2026-06-04T10:00:00Z'
  }
};

export const LegalDocumentsGroupedResponse = {
  type: 'object',
  additionalProperties: LegalDocumentResponse,
  properties: {
    privacyPolicy: LegalDocumentResponse,
    cookiePolicy: LegalDocumentResponse,
    communityRegulations: LegalDocumentResponse,
    termsOfService: LegalDocumentResponse
  }
};

export const LegalDocumentCreateBody = {
  type: 'object',
  required: ['slug', 'title', 'content'],
  properties: {
    slug: { type: 'string', example: 'privacy-policy' },
    title: { type: 'string', example: 'Privacy Policy' },
    content: { type: 'string', example: '<p>Privacy policy content...</p>' },
    contentType: { type: 'string', enum: ['html', 'markdown', 'plain_text'], example: 'html' },
    version: { type: 'string', example: '1.0' },
    status: { type: 'string', enum: ['draft', 'published', 'archived'], example: 'published' },
    effectiveDate: { type: 'string', example: '2026-06-04' }
  },
  example: {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    content: '<p>Privacy policy content...</p>',
    contentType: 'html',
    version: '1.0',
    status: 'published',
    effectiveDate: '2026-06-04'
  }
};

export const LegalDocumentUpdateBody = {
  ...LegalDocumentCreateBody,
  required: []
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
  UserActivityResponse,
  UserActivityPaginatedResponse,
  PostCreateBody,
  PostResponse,
  PostListResponse,
  PostMediaAttachBody,
  PostMediaResponse,
  PageImageResponse,
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
  PageCategoryPaginatedResponse,
  CommentPaginatedResponse,
  PageFollowerPaginatedResponse,
  JobResponse,
  JobCreateBody,
  JobPaginatedResponse,
  JobApplicationResponse,
  JobApplicationBody,
  JobApplicationPaginatedResponse,
  StatusUpdateBody,
  JobStatusUpdateBody,
  FreelanceJobStatusUpdateBody,
  AlertPreferencesResponse,
  AlertPreferencesBody,
  FreelancerProfileResponse,
  FreelancerCreateBody,
  FreelancerPaginatedResponse,
  FreelanceJobResponse,
  FreelanceJobCreateBody,
  FreelanceJobPaginatedResponse,
  FreelanceApplicationBody,
  FreelanceApplicationResponse,
  FreelanceApplicationPaginatedResponse,
  AdvertResponse,
  AdvertCreateBody,
  AdvertPaginatedResponse,
  AdvertLocationResponse,
  AdvertSiteResponse,
  AdvertOptionCreateBody,
  AdvertLocationPaginatedResponse,
  AdvertSitePaginatedResponse,
  ReactionBody,
  ReactionToggleResponse,
  PostSaveBody,
  PostReportBody,
  PostReportResponse,
  CommentReportResponse,
  PostShareBody,
  PostShareResponse,
  PostShareEventBody,
  PostShareEventResponse,
  JobShareBody,
  JobShareResponse,
  JobShareEventResponse,
  JobReferBody,
  JobReferResponse,
  LegalDocumentResponse,
  LegalDocumentsGroupedResponse,
  LegalDocumentCreateBody,
  LegalDocumentUpdateBody,
  UserProfileBody,
  UserProfileResponse,
  UserUpdateBody,
  UserUpdateResponse,
  PublicProfileResponse,
  AvatarUploadBody,
  ApiStringResponse,
  MediaRegisterBody,
  JobAcceptedResponse,
  CloudinarySignatureResponse,
  MediaJobStatusResponse,
  PageCategoryCreateBody,
  PageCreateBody,
  PagePrefillResponse,
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
  CommunityPaginatedResponse,
  FullProfileResponse,
  UserPrivacyBody,
  UserPrivacyGetResponse,
  UserPrivacyUpdateResponse,
  UserSettingsBody,
  UserSettingsResponse,
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
  FollowGroupResponse,
  OAuthAccount,
  UserLoginHistory
};
