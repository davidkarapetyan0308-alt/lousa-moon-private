export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface LoginRequest { email: string; password: string }
export interface LoginResponse {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
  demo: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string | null;
}
