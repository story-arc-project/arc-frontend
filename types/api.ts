export interface ApiSuccessResponse<T> {
  status: "success";
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  status: "error";
  message: string;
  code: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
