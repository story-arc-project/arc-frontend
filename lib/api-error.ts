export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  toJSON() {
    return { name: this.name, status: this.status, message: this.message };
  }

  toString() {
    return `[ApiError ${this.status}] ${this.message}`;
  }
}
