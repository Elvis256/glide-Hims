import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  IsDateString,
  IsPositive,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PRPriority } from '../../../database/entities/purchase-request.entity';

export class CreatePRItemDto {
  @IsString()
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
  @IsString()
  facilityId: string;

  @IsOptional()
  @IsString()
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
  @ValidateNested({ each: true })
  @Type(() => CreatePRItemDto)
  items: CreatePRItemDto[];
}

export class UpdatePurchaseRequestDto {
  @IsOptional()
  @IsString()
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
  @IsString()
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
  @IsString()
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
  @IsString()
  facilityId: string;

  @IsString()
  supplierId: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
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
  @ValidateNested({ each: true })
  @Type(() => CreatePOItemDto)
  items: CreatePOItemDto[];
}

export class CreatePOFromPRDto {
  @IsString()
  purchaseRequestId: string;

  @IsString()
  supplierId: string;

  @IsOptional()
  @IsDateString()
  expectedDelivery?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsArray()
  itemPrices?: { itemId: string; unitPrice: number }[];
}

export class CreatePOFromQuotationDto {
  @IsString()
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
  @IsString()
  itemId: string;

  @IsString()
  itemCode: string;

  @IsString()
  itemName: string;

  @IsOptional()
  @IsString()
  itemUnit?: string;

  @IsNumber()
  quantityExpected: number;

  @IsNumber()
  quantityReceived: number;

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
  @IsString()
  purchaseOrderItemId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  sellingPrice?: number;

  @IsOptional()
  @IsNumber()
  markupPercentage?: number;

  @IsOptional()
  @IsNumber()
  retailPrice?: number;

  @IsOptional()
  @IsNumber()
  wholesalePrice?: number;
}

export class CreateGoodsReceiptDto {
  @IsString()
  facilityId: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsString()
  supplierId: string;

  @IsOptional()
  @IsString()
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
  @IsNumber()
  invoiceAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGRNItemDto)
  items: CreateGRNItemDto[];
}

export class CreateGRNFromPOReceivedItemDto {
  @IsString()
  itemId: string;

  @IsNumber()
  quantityReceived: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class CreateGRNFromPODto {
  @IsString()
  purchaseOrderId: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGRNFromPOReceivedItemDto)
  receivedItems: CreateGRNFromPOReceivedItemDto[];
}

export class InspectGRNDto {
  @IsArray()
  inspectedItems: {
    itemId: string;
    quantityAccepted: number;
    quantityRejected: number;
    rejectionReason?: string;
  }[];

  @IsOptional()
  @IsString()
  inspectionNotes?: string;
}
