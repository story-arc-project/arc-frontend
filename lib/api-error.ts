export class ApiError extends Error {
  code: string | undefined;
  constructor(
    public readonly status: number,
    message: string,
    code?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code
  }

  toJSON() {
    return { name: this.name, status: this.status, message: this.message, code : this.code };
  }

  toString() {
    return `[ApiError ${this.status}] ${this.message}`;
  }
}
