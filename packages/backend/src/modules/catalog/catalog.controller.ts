import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequireModule } from '../auth/decorators/module.decorator';
import { CatalogService } from './catalog.service';

@RequireModule('stores')
@UseGuards(AuthGuard('jwt'))
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * Unified item search across all catalog sources.
   * GET /catalog/items/search?q=para&module=pharmacy&limit=20
   * GET /catalog/items/search?ids[]=<uuid>&ids[]=<uuid>  (bulk hydrate)
   */
  @Get('items/search')
  async searchItems(
    @Query('q') q: string,
    @Query('module') module: string,
    @Query('limit') limit: string,
    @Query('storeId') storeId: string,
    @Query('ids') ids: string | string[],
    @Request() req: any,
  ) {
    const tenantId = req?.user?.tenantId;

    // Bulk-hydrate mode: ?ids[]=uuid1&ids[]=uuid2
    if (ids && (Array.isArray(ids) ? ids.length > 0 : ids)) {
      const idList = Array.isArray(ids) ? ids : [ids];
      return this.catalogService.getItemsByIds(idList, tenantId);
    }

    return this.catalogService.searchItems({
      q: q || '',
      module: module || 'all',
      limit: limit ? Math.min(parseInt(limit, 10), 50) : 20,
      storeId,
      tenantId,
    });
  }
}
