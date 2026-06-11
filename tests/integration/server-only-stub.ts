// Vitest alias target for the "server-only" package. The real package throws
// when imported outside a React Server Component context; integration tests
// run in plain Node, where importing services is exactly what we want.
export {};
