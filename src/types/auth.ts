export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  position: string;
}

export interface AuthResponse {
  id: string;
  email: string;
  name: string;
  position: string;
  role: string;
  token: string;
}

export interface HisnetAuthResponse {
  token: string;
  userId: string;
  userName: string;
  department: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  position: string;
  role: string;
}