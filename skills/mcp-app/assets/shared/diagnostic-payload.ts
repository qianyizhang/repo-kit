export const PAYLOAD_LIMIT = 64 * 1024;
export function isCredentialField(key: string) {
  return /^(?:authorization|proxyauthorization|cookie|setcookie|password|secret|clientsecret|token|accesstoken|refreshtoken|idtoken|apikey|privatekey)$/.test(
    key.replace(/[-_]/g, "").toLowerCase(),
  );
}
export function snapshot(value: unknown, omit = false) {
  try {
    let redacted = false;
    const original = JSON.stringify(value) ?? "null";
    const text =
      JSON.stringify(
        value,
        (key, item: unknown) => {
          if (isCredentialField(key)) {
            redacted = true;
            return "[redacted]";
          }
          return item;
        },
        2,
      ) ?? "null";
    const bytes = new TextEncoder().encode(text);
    return {
      text: omit
        ? "[payload omitted by recording policy]"
        : new TextDecoder().decode(bytes.slice(0, PAYLOAD_LIMIT)),
      originalBytes: new TextEncoder().encode(original).length,
      redacted,
      truncated: bytes.length > PAYLOAD_LIMIT,
      omitted: omit,
    };
  } catch {
    return {
      text: "[payload unavailable: serialization failed]",
      originalBytes: 0,
      redacted: false,
      truncated: false,
      omitted: true,
    };
  }
}
