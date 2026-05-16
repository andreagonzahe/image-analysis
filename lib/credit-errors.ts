/**
 * Specialized error type the providers throw when an account hits its
 * spend / credit ceiling (HTTP 402 from Together; sustained 429s from
 * Replicate when credit < $5). The job worker catches this specifically
 * and pauses the whole batch instead of letting attempts bleed out.
 *
 * Keeps the rest of the worker simple — it only needs one catch for
 * "stop, this is a money problem."
 */
export class CreditExhaustedError extends Error {
  readonly provider: "together" | "replicate";
  readonly details: string;
  constructor(provider: "together" | "replicate", details: string) {
    super(`[${provider}] credit exhausted: ${details.slice(0, 200)}`);
    this.name = "CreditExhaustedError";
    this.provider = provider;
    this.details = details;
  }
}

export function isCreditExhaustedError(err: unknown): err is CreditExhaustedError {
  return err instanceof CreditExhaustedError || (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "CreditExhaustedError"
  );
}
