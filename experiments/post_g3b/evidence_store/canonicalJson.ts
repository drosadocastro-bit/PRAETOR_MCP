type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function assertJsonValue(value: unknown, path: string): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number at ${path}.`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) throw new Error(`Undefined value at ${path}.${key}.`);
      assertJsonValue(item, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`Unsupported JSON value at ${path}.`);
}

function serialize(value: JsonValue): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '0' : JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(serialize).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${serialize(value[key]!)}`).join(',')}}`;
}

/** Deterministic key-order JSON for manifests. This does not claim RFC 8785 compliance. */
export function canonicalJson(value: unknown): string {
  assertJsonValue(value, '$');
  return serialize(value);
}
