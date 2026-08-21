export interface StructuredApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly body: StructuredApiError | undefined;

  constructor(statusCode: number, body: StructuredApiError | undefined) {
    super(
      Array.isArray(body?.message)
        ? body.message.join(", ")
        : (body?.message ?? `Request failed (${statusCode})`),
    );
    this.statusCode = statusCode;
    this.body = body;
  }
}
