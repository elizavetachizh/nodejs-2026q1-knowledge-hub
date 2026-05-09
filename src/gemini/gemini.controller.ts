import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { SummarizeArticleRequest } from './dto/summarize-gemini.dto';
import { TranslateArticleRequest } from './dto/translate-gemini.dto';
import {
  ApiTags,
  ApiOkResponse,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { AnalyzeArticleRequest } from './dto/analyze-gemini.dto';
import {
  AiGenerateContentRequestDto,
  AiGenerateContentResponseDto,
} from './dto/generate-ai.dto';
import { AppThrottlerGuard } from 'src/common/guards/throttler.guard';
import { getPositiveInt } from 'src/common/utils/get-positive-int';
import { GeminiUsageService } from './gemini-usage.service';
import { GeminiUsageSnapshotDto } from './dto/ai-usage-snapshot.dto';
import type { GeminiUsageSnapshot } from './gemini-usage.service';

@ApiTags('AI')
@Controller('ai')
@UseGuards(AppThrottlerGuard)
export class GeminiController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly geminiUsageService: GeminiUsageService,
  ) {}

  @Get('usage')
  @SkipThrottle()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'AI usage & observability (in-memory since process start)',
    description:
      'Requires JWT (VIEWER, EDITOR, or ADMIN). Totals, per-route counts, token sums (`usageMetadata` when present), **round-trip latency** per Gemini call, **`summarize` / `translate` cache hit ratio**, and counters for **structured-response fallbacks** on analyze & translate.',
  })
  @ApiOkResponse({ type: GeminiUsageSnapshotDto })
  @HttpCode(HttpStatus.OK)
  getAiUsage(): GeminiUsageSnapshot {
    return this.geminiUsageService.snapshot();
  }

  @Post('articles/:id/summarize')
  @ApiBearerAuth('bearer')
  @Throttle({
    default: {
      ttl: getPositiveInt(process.env.AI_RATE_WINDOW_MS, 60000),
      limit: getPositiveInt(process.env.AI_RATE_LIMIT_RPM, 20),
    },
  })
  @HttpCode(HttpStatus.OK)
  async summarizeArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SummarizeArticleRequest,
  ) {
    return this.geminiService.summarizeArticle(id, body);
  }

  @Post('articles/:id/translate')
  @ApiBearerAuth('bearer')
  @Throttle({
    default: {
      ttl: getPositiveInt(process.env.AI_RATE_WINDOW_MS, 60000),
      limit: getPositiveInt(process.env.AI_RATE_LIMIT_RPM, 20),
    },
  })
  @HttpCode(HttpStatus.OK)
  async translateArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TranslateArticleRequest,
  ) {
    return this.geminiService.translateArticle(id, body);
  }

  @Post('articles/:id/analyze')
  @ApiBearerAuth('bearer')
  @Throttle({
    default: {
      ttl: getPositiveInt(process.env.AI_RATE_WINDOW_MS, 60000),
      limit: getPositiveInt(process.env.AI_RATE_LIMIT_RPM, 20),
    },
  })
  @HttpCode(HttpStatus.OK)
  async analyzeArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AnalyzeArticleRequest,
  ) {
    return this.geminiService.analyzeArticle(id, body);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Free-form AI generation',
    description: '**Public** — no JWT. Not tied to Knowledge Hub articles.',
  })
  @Throttle({
    default: {
      ttl: getPositiveInt(process.env.AI_RATE_WINDOW_MS, 60000),
      limit: getPositiveInt(process.env.AI_RATE_LIMIT_RPM, 20),
    },
  })
  @ApiOkResponse({ type: AiGenerateContentResponseDto })
  @HttpCode(HttpStatus.OK)
  async generateContent(@Body() body: AiGenerateContentRequestDto) {
    return this.geminiService.generateContent(body);
  }
}
