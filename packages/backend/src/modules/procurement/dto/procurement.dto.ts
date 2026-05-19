import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsDateString,
  IsPositive,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PRPriority, PRStatus } from '../../../database/entities/purchase-request.entity';
import { POStatus } from '../../../database/entities/purchase-order.entity';
import { GRNStatus } from '../../../database/entities/goods-receipt.entity';

export class CreatePRItemDto {
  @IsUUID()
  itemId: string;

  @IsString()
  itemCode: string;

  @IsString()
  itemName: string;

  @IsOptional()
  @IsString()
  itemUnit?: string;

  @IsPositive()
  quantityRequested: number;

  @IsOptional()
  @Min(0)
  @IsNumber()
  unitPriceEstimated?: number;

  @IsOptional()
  @IsString()
  specifications?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseRequestDto {
  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(PRPriority)
  priority?: PRPriority;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsDateString()
  requiredDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreatePRItemDto)
  items: CreatePRItemDto[];
}

export class UpdatePurchaseRequestDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(PRPriority)
  priority?: PRPriority;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsDateString()
  requiredDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePRItemDto)
  items?: CreatePRItemDto[];
}

export class ApprovedItemDto {
  @IsUUID()
  itemId: string;

  @IsPositive()
  quantityApproved: number;
}

export class ApprovePRDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovedItemDto)
  approvedItems?: ApprovedItemDto[];

  @IsOptional()
  @IsString()
  comments?: string;
}

export class RejectPRDto {
  @IsString()
  rejectionReason: string;
}

// Purchase Order DTOs
export class CreatePOItemDto {
  @IsUUID()
  itemId: string;

  @IsString()
  itemCode: string;

  @IsString()
  itemName: string;

  @IsOptional()
  @IsString()
  itemUnit?: string;

  @IsPositive()
  quantityOrdered: number;

  @Min(0)
  @IsNumber()
  unitPrice: number;

  @IsOptional()
  @Min(0)
  @Max(100)
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @Min(0)
  @Max(100)
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  facilityId: string;

  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsUUID()
  purchaseRequestId?: string;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsDateString()
  expectedDelivery?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  emergencyJustification?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreatePOItemDto)
  items: CreatePOItemDto[];
}

export class POFromPRItemPriceDto {
  @IsUUID()
  itemId: string;

  @Min(0)
  @IsNumber()
  unitPrice: number;
}

export class CreatePOFromPRDto {
  @IsUUID()
  purchaseRequestId: string;

  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsDateString()
  expectedDelivery?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => POFromPRItemPriceDto)
  itemPrices?: POFromPRItemPriceDto[];
}

export class CreatePOFromQuotationDto {
  @IsUUID()
  quotationId: string;

  @IsOptional()
  @IsDateString()
  expectedDelivery?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// Goods Receipt Note DTOs
export class CreateGRNItemDto {
  @IsUUID()
  itemId: string;

  @IsString()
  itemCode: string;

  @IsString()
  itemName: string;

  @IsOptional()
  @IsString()
  itemUnit?: string;

  @Min(0)
  @IsNumber()
  quantityExpected: number;

  @Min(0)
  @IsNumber()
  quantityReceived: number;

  @Min(0)
  @IsNumber()
  unitCost: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderItemId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Min(0)
  @IsNumber()
  sellingPrice?: number;

  @IsOptional()
  @Min(0)
  @Max(1000)
  @IsNumber()
  markupPercentage?: number;

  @IsOptional()
  @Min(0)
  @IsNumber()
  retailPrice?: number;

  @IsOptional()
  @Min(0)
  @IsNumber()
  wholesalePrice?: number;
}

export class CreateGoodsReceiptDto {
  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  deliveryNoteNumber?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @Min(0)
  @IsNumber()
  invoiceAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateGRNItemDto)
  items: CreateGRNItemDto[];
}

export class CreateGRNFromPOReceivedItemDto {
  @IsUUID()
  itemId: string;

  @Min(0)
  @IsNumber()
  quantityReceived: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class CreateGRNFromPODto {
  @IsUUID()
  purchaseOrderId: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateGRNFromPOReceivedItemDto)
  receivedItems: CreateGRNFromPOReceivedItemDto[];
}

export class InspectedGRNItemDto {
  @IsUUID()
  itemId: string;

  @Min(0)
  @IsNumber()
  quantityAccepted: number;

  @Min(0)
  @IsNumber()
  quantityRejected: number;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class InspectGRNDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => InspectedGRNItemDto)
  inspectedItems: InspectedGRNItemDto[];

  @IsOptional()
  @IsString()
  inspectionNotes?: string;
}

// ============ QUERY DTOs ============

export class ListPurchaseRequestsQueryDto {
  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsEnum(PRStatus)
  status?: PRStatus;

  @IsOptional()
  @IsEnum(PRPriority)
  priority?: PRPriority;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ListPurchaseOrdersQueryDto {
  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsEnum(POStatus)
  status?: POStatus;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ListGoodsReceiptsQueryDto {
  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsEnum(GRNStatus)
  status?: GRNStatus;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class FacilityIdQueryDto {
  @IsUUID()
  facilityId: string;
}

export class OptionalFacilityIdQueryDto {
  @IsOptional()
  @IsUUID()
  facilityId?: string;
}

export class TraceSearchQueryDto {
  @IsString()
  q: string;
}

export class RunReorderBodyDto {
  @IsOptional()
  @IsUUID()
  facilityId?: string;
}

export class ThreeWayMatchQueryDto {
  @IsUUID()
  poId: string;

  @IsUUID()
  grnId: string;

  @IsUUID()
  invoiceId: string;
}

export class ReconciliationReportQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class DateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class SupplierSpendTrendsQueryDto {
  @IsUUID()
  supplierId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(120)
  months?: number;
}

export class SupplierIdQueryDto {
  @IsUUID()
  supplierId: string;
}

export class LimitQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class MonthsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(120)
  months?: number;
}

export class DaysQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(3650)
  days?: number;
}

export class UpdatePRItemBodyDto {
  @IsOptional()
  @IsPositive()
  quantityRequested?: number;

  @IsOptional()
  @Min(0)
  @IsNumber()
  unitPriceEstimated?: number;
}
