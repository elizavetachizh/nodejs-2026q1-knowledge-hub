import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RagIndexRequestDto } from './dto/rag-index.request.dto';
import { RagService } from './rag.service';
import { RagSearchRequestDto } from './dto/rag-search-request.dto';
import { RagChatResponse, RagSearchResponse } from './rag.types';
import { RagChatRequestDto } from './dto/rag-chat.dto';

@ApiTags('RAG')
@ApiBearerAuth('bearer')
@Controller('ai/rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('index')
  @ApiOperation({
    summary: 'Build/refresh Knowledge Hub vector index',
    description:
      'Reads Knowledge Hub articles, splits content into chunks, generates embeddings, and stores vectors with metadata in the vector DB. Use this endpoint after article updates or for full/partial reindex.',
  })
  @HttpCode(HttpStatus.OK)
  async indexArticle(@Body() body: RagIndexRequestDto) {
    return this.ragService.indexArticle(body);
  }

  @Post('search')
  @ApiOperation({
    summary: 'Semantic search over indexed article chunks',
    description:
      'Finds the most relevant article chunks for a user query using vector similarity (and optional ranking stages). Supports filters by article status, category, and tags.',
  })
  @HttpCode(HttpStatus.OK)
  async search(@Body() body: RagSearchRequestDto): Promise<RagSearchResponse> {
    return this.ragService.search(body);
  }

  @Post('chat')
  @ApiOperation({
    summary: 'Ask grounded RAG question and get answer with sources',
    description:
      'Runs end-to-end RAG flow: embeds question, retrieves relevant chunks, builds grounded prompt for Gemini, and returns final answer with source attribution. Optional conversationId keeps multi-turn context.',
  })
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: RagChatRequestDto): Promise<RagChatResponse> {
    return this.ragService.chat(body);
  }

  @Get('chat/:conversationId/history')
  @ApiOperation({ summary: 'Get chat history' })
  @ApiParam({
    name: 'conversationId',
    type: String,
    description: 'Conversation ID',
  })
  async chatHistory(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.ragService.chatHistory(conversationId);
  }

  @Delete('index/articles/:articleId')
  @HttpCode(204)
  async deleteByArticleId(
    @Param('articleId') articleId: string,
  ): Promise<void> {
    await this.ragService.deleteByArticleId(articleId);
  }
}
