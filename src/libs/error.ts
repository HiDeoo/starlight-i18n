export class StarlightI18nParseError extends Error {
  constructor(public override cause?: unknown) {
    super('Failed to parse Starlight configuration.', { cause })
  }
}
