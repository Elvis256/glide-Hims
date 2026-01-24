import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/suppliers.dto';
import { SupplierType, SupplierStatus } from '../../database/entities/supplier.entity';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Auth('Admin', 'Storekeeper', 'Procurement')
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Get()
  @Auth()
  findAll(
    @Query('facilityId') facilityId: string,
    @Query('type') type?: SupplierType,
    @Query('status') status?: SupplierStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.suppliersService.findAll(facilityId, {
      type,
      status,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('active')
  @Auth()
  getActiveSuppliers(@Query('facilityId') facilityId: string) {
    return this.suppliersService.getActiveSuppliers(facilityId);
  }

  @Get('dashboard')
  @Auth()
  getDashboard(@Query('facilityId') facilityId: string) {
    return this.suppliersService.getDashboard(facilityId);
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Put(':id')
  @Auth('Admin', 'Storekeeper', 'Procurement')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Delete(':id')
  @Auth('Admin', 'Procurement')
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }
}
