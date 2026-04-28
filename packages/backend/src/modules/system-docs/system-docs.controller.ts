import {
  Controller,
  Get,
  Param,
  Request,
  ForbiddenException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

const DOCS_ROOT = path.resolve(__dirname, '../../../../../website/docs');

const PUBLIC_PAGES = [
  { slug: 'index', title: 'Overview' },
  { slug: 'quickstart', title: 'Quick Start' },
  { slug: 'architecture', title: 'Architecture' },
  { slug: 'api-overview', title: 'API Overview' },
  { slug: 'api-auth', title: 'Authentication' },
  { slug: 'api-patients', title: 'Patients API' },
  { slug: 'api-billing', title: 'Billing API' },
  { slug: 'api-inventory', title: 'Inventory API' },
  { slug: 'changelog', title: 'Changelog' },
];

const OPERATOR_PAGES = [
  { slug: 'deployment-onpremise', title: 'On-Premise Deployment' },
  { slug: 'deployment-cloud', title: 'Cloud Deployment' },
  { slug: 'docker', title: 'Docker' },
  { slug: 'kubernetes', title: 'Kubernetes' },
  { slug: 'monitoring', title: 'Monitoring' },
  { slug: 'backup', title: 'Backup & Restore' },
  { slug: 'troubleshooting', title: 'Troubleshooting' },
  { slug: 'feature-flags', title: 'Feature Flags' },
  { slug: 'phone-home', title: 'Phone Home' },
  { slug: 'updates', title: 'Updates' },
  { slug: 'licensing', title: 'Licensing' },
];

const ALL_SLUGS = new Set([...PUBLIC_PAGES, ...OPERATOR_PAGES].map((p) => p.slug));

@ApiTags('system-docs')
@Controller('system/docs')
export class SystemDocsController {
  @Get()
  @AuthWithPermissions()
  @ApiOperation({ summary: 'List documentation pages (system admin only)' })
  async listPages(@Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    return {
      sections: [
        { title: 'Getting Started', pages: PUBLIC_PAGES },
        { title: 'Operations', pages: OPERATOR_PAGES },
      ],
    };
  }

  @Get(':slug')
  @AuthWithPermissions()
  @ApiOperation({ summary: 'Render a documentation page (system admin only)' })
  async getPage(
    @Param('slug') rawSlug: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    const slug = rawSlug.replace(/\.html$/i, '');
    if (!/^[a-z0-9-]+$/.test(slug) || !ALL_SLUGS.has(slug)) {
      throw new NotFoundException('Documentation page not found');
    }
    const filePath = path.join(DOCS_ROOT, `${slug}.html`);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(DOCS_ROOT) || !fs.existsSync(resolved)) {
      throw new NotFoundException('Documentation page not found');
    }
    const html = fs.readFileSync(resolved, 'utf8');
    // Rewrite relative <a href="other.html"> links so navigation inside the
    // iframe stays on the same controller endpoint.
    const rewritten = html.replace(
      /href="([a-z0-9-]+)\.html"/gi,
      (_m, p1) => `href="/api/v1/system/docs/${p1}"`,
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(rewritten);
  }
}
