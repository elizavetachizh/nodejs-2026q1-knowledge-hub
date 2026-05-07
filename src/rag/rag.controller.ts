import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  async indexArticle(@Body() body: RagIndexRequestDto) {
    return this.ragService.indexArticle(body);
  }

  @Post('search')
  async search(@Body() body: RagSearchRequestDto): Promise<RagSearchResponse> {
    return this.ragService.search(body);
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: RagChatRequestDto): Promise<RagChatResponse> {
    return this.ragService.chat(body);
  }

  @Get('chat')
  async chatHistory(@Query('conversationId') conversationId: string) {
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
