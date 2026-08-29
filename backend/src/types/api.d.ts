export { };

declare global{
  interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
  }
  
  interface LoginData {
    accessToken: string;
    user: {
      id: string;
      name: string;
      role: string;
      profileImageUrl: string;
      emailVerified: boolean;
    };
  }
}