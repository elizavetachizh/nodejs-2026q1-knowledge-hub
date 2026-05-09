import { ApiProperty } from '@nestjs/swagger';

export class AiUsageByEndpointDto {
  @ApiProperty()
  summarize: number;

  @ApiProperty()
  translate: number;

  @ApiProperty()
  analyze: number;

  @ApiProperty()
  generate: number;
}

export class GeminiLatencyStatsDto {
  @ApiProperty({ description: 'Number of Gemini calls with latency samples' })
  count: number;

  @ApiProperty({ description: 'Sum of round-trip times (ms) for those calls' })
  totalMs: number;

  @ApiProperty({ description: 'Slowest sample (ms)' })
  maxMs: number;

  @ApiProperty({
    description:
      'Arithmetic mean round-trip (ms), `totalMs / count` rounded to integer',
  })
  avgMs: number;
}

export class LatencyMsByEndpointDto {
  @ApiProperty({ type: GeminiLatencyStatsDto, nullable: true })
  summarize: GeminiLatencyStatsDto | null;

  @ApiProperty({ type: GeminiLatencyStatsDto, nullable: true })
  translate: GeminiLatencyStatsDto | null;

  @ApiProperty({ type: GeminiLatencyStatsDto, nullable: true })
  analyze: GeminiLatencyStatsDto | null;

  @ApiProperty({ type: GeminiLatencyStatsDto, nullable: true })
  generate: GeminiLatencyStatsDto | null;
}

export class CacheStatsDto {
  @ApiProperty()
  hits: number;

  @ApiProperty()
  misses: number;

  @ApiProperty({
    description:
      'Hits divided by `hits + misses`, two decimal places; null if no lookups yet',
    nullable: true,
  })
  hitRatio: number | null;
}

export class GeminiCacheSnapshotDto {
  @ApiProperty({ type: CacheStatsDto })
  summarize: CacheStatsDto;

  @ApiProperty({ type: CacheStatsDto })
  translate: CacheStatsDto;
}

export class GeminiDiagnosticsDto {
  @ApiProperty({
    description:
      'Times `/ai/articles/.../analyze` coerced or fell back to unstructured text',
  })
  analyzeStructuredFallbacks: number;

  @ApiProperty({
    description:
      'Times `/ai/articles/.../translate` used plain-text or missing-field recovery',
  })
  translateStructuredFallbacks: number;
}

export class GeminiUsageSnapshotDto {
  @ApiProperty({
    description: 'Successful upstream Gemini calls counted since process start',
  })
  totalRequests: number;

  @ApiProperty({ type: AiUsageByEndpointDto })
  byEndpoint: AiUsageByEndpointDto;

  @ApiProperty({
    description:
      'Cumulative prompt tokens when Gemini responses include usageMetadata',
  })
  totalPromptTokens: number;

  @ApiProperty({
    description:
      'Cumulative completion tokens when Gemini responses include usageMetadata',
  })
  totalCandidateTokens: number;

  @ApiProperty({
    description:
      'Cumulative total tokens when Gemini responses include usageMetadata',
  })
  totalTokens: number;

  @ApiProperty({
    type: LatencyMsByEndpointDto,
    description:
      'Per-endpoint latency averages for actual Gemini HTTP requests (cache hits excluded)',
  })
  latencyMsByEndpoint: LatencyMsByEndpointDto;

  @ApiProperty({ type: GeminiCacheSnapshotDto })
  cache: GeminiCacheSnapshotDto;

  @ApiProperty({ type: GeminiDiagnosticsDto })
  diagnostics: GeminiDiagnosticsDto;
}
