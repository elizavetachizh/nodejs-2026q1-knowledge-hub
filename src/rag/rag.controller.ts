import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RagIndexRequestDto } from './dto/rag-index.request.dto';
import { RagService } from './rag.service';
import { RagSearchRequestDto } from './dto/rag-search-request.dto';

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
  async search(@Body() body: RagSearchRequestDto) {
    return this.ragService.search(body);
  }
}
