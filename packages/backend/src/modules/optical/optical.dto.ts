import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsArray,
  IsDateString,
  IsInt,
  IsEnum,
  IsObject,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============ EYE EXAM ============

export class CreateEyeExamDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  patientId: string;

  @ApiProperty({
    description: 'Type of exam',
    enum: ['comprehensive', 'follow_up', 'contact_lens_fitting', 'visual_field', 'retinal_screening'],
  })
  @IsString()
  @IsEnum(['comprehensive', 'follow_up', 'contact_lens_fitting', 'visual_field', 'retinal_screening'])
  examType: string;

  @ApiPropertyOptional({ description: 'Chief complaint' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  chiefComplaint?: string;

  @ApiPropertyOptional({
    description: 'Visual acuity measurements',
    example: { od: { uncorrected: '20/40', corrected: '20/20' }, os: { uncorrected: '20/60', corrected: '20/25' } },
  })
  @IsOptional()
  @IsObject()
  visualAcuity?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Autorefraction data',
    example: { od: { sphere: -2.50, cylinder: -0.75, axis: 90 }, os: { sphere: -3.00, cylinder: -1.00, axis: 85 } },
  })
  @IsOptional()
  @IsObject()
  autorefraction?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Intraocular pressure',
    example: { od: 16, os: 15, method: 'applanation' },
  })
  @IsOptional()
  @IsObject()
  intraocularPressure?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Anterior segment findings' })
  @IsOptional()
  @IsObject()
  anteriorSegment?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Posterior segment findings' })
  @IsOptional()
  @IsObject()
  posteriorSegment?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Pupil reaction', example: 'PERRLA' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pupilReaction?: string;

  @ApiPropertyOptional({ description: 'Color vision result' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  colorVision?: string;

  @ApiPropertyOptional({
    description: 'Diagnosis array',
    example: [{ code: 'H52.1', description: 'Myopia' }],
  })
  @IsOptional()
  @IsArray()
  diagnosis?: Array<{ code: string; description: string }>;

  @ApiPropertyOptional({ description: 'Recommendations' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendations?: string;

  @ApiPropertyOptional({ description: 'Next exam date' })
  @IsOptional()
  @IsDateString()
  nextExamDate?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ============ OPTICAL PRESCRIPTION ============

export class CreateOpticalPrescriptionDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional({ description: 'Eye exam ID' })
  @IsOptional()
  @IsUUID()
  examId?: string;

  @ApiProperty({
    description: 'Prescription type',
    enum: ['spectacle', 'contact_lens'],
  })
  @IsString()
  @IsEnum(['spectacle', 'contact_lens'])
  prescriptionType: string;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  // Right eye (OD)
  @ApiPropertyOptional({ description: 'OD Sphere', example: -2.50 })
  @IsOptional()
  @IsNumber()
  odSphere?: number;

  @ApiPropertyOptional({ description: 'OD Cylinder', example: -0.75 })
  @IsOptional()
  @IsNumber()
  odCylinder?: number;

  @ApiPropertyOptional({ description: 'OD Axis (0-180)', example: 90 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  odAxis?: number;

  @ApiPropertyOptional({ description: 'OD Add (reading addition)', example: 2.00 })
  @IsOptional()
  @IsNumber()
  odAdd?: number;

  @ApiPropertyOptional({ description: 'OD Prism' })
  @IsOptional()
  @IsNumber()
  odPrism?: number;

  @ApiPropertyOptional({ description: 'OD Prism base direction', enum: ['up', 'down', 'in', 'out'] })
  @IsOptional()
  @IsString()
  @IsEnum(['up', 'down', 'in', 'out'])
  odPrismBase?: string;

  // Left eye (OS)
  @ApiPropertyOptional({ description: 'OS Sphere', example: -3.00 })
  @IsOptional()
  @IsNumber()
  osSphere?: number;

  @ApiPropertyOptional({ description: 'OS Cylinder', example: -1.00 })
  @IsOptional()
  @IsNumber()
  osCylinder?: number;

  @ApiPropertyOptional({ description: 'OS Axis (0-180)', example: 85 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  osAxis?: number;

  @ApiPropertyOptional({ description: 'OS Add (reading addition)' })
  @IsOptional()
  @IsNumber()
  osAdd?: number;

  @ApiPropertyOptional({ description: 'OS Prism' })
  @IsOptional()
  @IsNumber()
  osPrism?: number;

  @ApiPropertyOptional({ description: 'OS Prism base direction', enum: ['up', 'down', 'in', 'out'] })
  @IsOptional()
  @IsString()
  @IsEnum(['up', 'down', 'in', 'out'])
  osPrismBase?: string;

  @ApiPropertyOptional({ description: 'Pupillary distance (mm)', example: 63.5 })
  @IsOptional()
  @IsNumber()
  pd?: number;

  @ApiPropertyOptional({ description: 'Near pupillary distance (mm)' })
  @IsOptional()
  @IsNumber()
  pdNear?: number;

  @ApiPropertyOptional({ description: 'Segment height (mm)' })
  @IsOptional()
  @IsNumber()
  segmentHeight?: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ============ CONTACT LENS PRESCRIPTION ============

export class CreateContactLensPrescriptionDto {
  @ApiProperty({ description: 'Optical prescription ID' })
  @IsUUID()
  prescriptionId: string;

  // Right eye (OD)
  @ApiPropertyOptional({ description: 'OD base curve', example: 8.60 })
  @IsOptional()
  @IsNumber()
  odBaseCurve?: number;

  @ApiPropertyOptional({ description: 'OD diameter (mm)', example: 14.2 })
  @IsOptional()
  @IsNumber()
  odDiameter?: number;

  @ApiPropertyOptional({ description: 'OD lens brand' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  odBrand?: string;

  @ApiPropertyOptional({ description: 'OD lens model' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  odModel?: string;

  @ApiPropertyOptional({ description: 'OD lens color' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  odColor?: string;

  // Left eye (OS)
  @ApiPropertyOptional({ description: 'OS base curve', example: 8.60 })
  @IsOptional()
  @IsNumber()
  osBaseCurve?: number;

  @ApiPropertyOptional({ description: 'OS diameter (mm)', example: 14.2 })
  @IsOptional()
  @IsNumber()
  osDiameter?: number;

  @ApiPropertyOptional({ description: 'OS lens brand' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  osBrand?: string;

  @ApiPropertyOptional({ description: 'OS lens model' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  osModel?: string;

  @ApiPropertyOptional({ description: 'OS lens color' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  osColor?: string;

  @ApiPropertyOptional({
    description: 'Wear schedule',
    enum: ['daily', 'bi_weekly', 'monthly', 'extended'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['daily', 'bi_weekly', 'monthly', 'extended'])
  wearSchedule?: string;

  @ApiPropertyOptional({ description: 'Replacement schedule' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  replacementSchedule?: string;

  @ApiPropertyOptional({ description: 'Contact lens solution' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  solution?: string;

  @ApiPropertyOptional({ description: 'Trial lens notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  trialLensNotes?: string;
}

// ============ FRAME ============

export class CreateFrameDto {
  @ApiProperty({ description: 'Frame brand', example: 'Ray-Ban' })
  @IsString()
  @MaxLength(100)
  brand: string;

  @ApiProperty({ description: 'Frame model', example: 'RB5154' })
  @IsString()
  @MaxLength(100)
  model: string;

  @ApiPropertyOptional({ description: 'SKU' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @ApiPropertyOptional({ description: 'Color' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ description: 'Size (e.g., 52-18-140)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  @ApiPropertyOptional({
    description: 'Frame material',
    enum: ['metal', 'plastic', 'titanium', 'acetate', 'tr90', 'wood', 'combination'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['metal', 'plastic', 'titanium', 'acetate', 'tr90', 'wood', 'combination'])
  material?: string;

  @ApiPropertyOptional({
    description: 'Frame type',
    enum: ['full_rim', 'semi_rimless', 'rimless', 'wrap'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['full_rim', 'semi_rimless', 'rimless', 'wrap'])
  frameType?: string;

  @ApiPropertyOptional({
    description: 'Target gender',
    enum: ['unisex', 'male', 'female', 'kids'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['unisex', 'male', 'female', 'kids'])
  gender?: string;

  @ApiPropertyOptional({ description: 'Wholesale price' })
  @IsOptional()
  @IsNumber()
  wholesalePrice?: number;

  @ApiPropertyOptional({ description: 'Retail price' })
  @IsOptional()
  @IsNumber()
  retailPrice?: number;

  @ApiPropertyOptional({ description: 'Current stock quantity' })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentStock?: number;

  @ApiPropertyOptional({ description: 'Reorder level' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional({ description: 'Supplier name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplier?: string;
}

export class UpdateFrameDto {
  @ApiPropertyOptional({ description: 'Frame brand' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @ApiPropertyOptional({ description: 'Frame model' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ description: 'SKU' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @ApiPropertyOptional({ description: 'Color' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ description: 'Size' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  @ApiPropertyOptional({
    description: 'Frame material',
    enum: ['metal', 'plastic', 'titanium', 'acetate', 'tr90', 'wood', 'combination'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['metal', 'plastic', 'titanium', 'acetate', 'tr90', 'wood', 'combination'])
  material?: string;

  @ApiPropertyOptional({
    description: 'Frame type',
    enum: ['full_rim', 'semi_rimless', 'rimless', 'wrap'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['full_rim', 'semi_rimless', 'rimless', 'wrap'])
  frameType?: string;

  @ApiPropertyOptional({
    description: 'Target gender',
    enum: ['unisex', 'male', 'female', 'kids'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['unisex', 'male', 'female', 'kids'])
  gender?: string;

  @ApiPropertyOptional({ description: 'Wholesale price' })
  @IsOptional()
  @IsNumber()
  wholesalePrice?: number;

  @ApiPropertyOptional({ description: 'Retail price' })
  @IsOptional()
  @IsNumber()
  retailPrice?: number;

  @ApiPropertyOptional({ description: 'Current stock quantity' })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentStock?: number;

  @ApiPropertyOptional({ description: 'Reorder level' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional({ description: 'Supplier name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplier?: string;

  @ApiPropertyOptional({ description: 'Image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Whether frame is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============ LENS PRODUCT ============

export class CreateLensProductDto {
  @ApiProperty({ description: 'Lens name' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'SKU' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @ApiProperty({
    description: 'Lens type',
    enum: ['single_vision', 'bifocal', 'progressive', 'occupational', 'reading'],
  })
  @IsString()
  @IsEnum(['single_vision', 'bifocal', 'progressive', 'occupational', 'reading'])
  lensType: string;

  @ApiProperty({
    description: 'Lens material',
    enum: ['cr39', 'polycarbonate', 'trivex', 'hi_index_1.67', 'hi_index_1.74', 'glass'],
  })
  @IsString()
  @IsEnum(['cr39', 'polycarbonate', 'trivex', 'hi_index_1.67', 'hi_index_1.74', 'glass'])
  material: string;

  @ApiPropertyOptional({
    description: 'Lens coatings',
    example: ['anti_reflective', 'blue_light'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coating?: string[];

  @ApiPropertyOptional({ description: 'Refractive index', example: 1.67 })
  @IsOptional()
  @IsNumber()
  index?: number;

  @ApiPropertyOptional({ description: 'Wholesale price' })
  @IsOptional()
  @IsNumber()
  wholesalePrice?: number;

  @ApiPropertyOptional({ description: 'Retail price' })
  @IsOptional()
  @IsNumber()
  retailPrice?: number;

  @ApiPropertyOptional({ description: 'Current stock quantity' })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentStock?: number;

  @ApiPropertyOptional({ description: 'Supplier name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplier?: string;
}

export class UpdateLensProductDto {
  @ApiPropertyOptional({ description: 'Lens name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'SKU' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @ApiPropertyOptional({
    description: 'Lens type',
    enum: ['single_vision', 'bifocal', 'progressive', 'occupational', 'reading'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['single_vision', 'bifocal', 'progressive', 'occupational', 'reading'])
  lensType?: string;

  @ApiPropertyOptional({
    description: 'Lens material',
    enum: ['cr39', 'polycarbonate', 'trivex', 'hi_index_1.67', 'hi_index_1.74', 'glass'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['cr39', 'polycarbonate', 'trivex', 'hi_index_1.67', 'hi_index_1.74', 'glass'])
  material?: string;

  @ApiPropertyOptional({ description: 'Lens coatings' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coating?: string[];

  @ApiPropertyOptional({ description: 'Refractive index' })
  @IsOptional()
  @IsNumber()
  index?: number;

  @ApiPropertyOptional({ description: 'Wholesale price' })
  @IsOptional()
  @IsNumber()
  wholesalePrice?: number;

  @ApiPropertyOptional({ description: 'Retail price' })
  @IsOptional()
  @IsNumber()
  retailPrice?: number;

  @ApiPropertyOptional({ description: 'Current stock quantity' })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentStock?: number;

  @ApiPropertyOptional({ description: 'Supplier name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplier?: string;

  @ApiPropertyOptional({ description: 'Whether lens product is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============ SPECTACLE ORDER ============

export class CreateSpectacleOrderDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ description: 'Prescription ID' })
  @IsUUID()
  prescriptionId: string;

  @ApiPropertyOptional({ description: 'Frame ID' })
  @IsOptional()
  @IsUUID()
  frameId?: string;

  @ApiPropertyOptional({ description: 'Lens product ID' })
  @IsOptional()
  @IsUUID()
  lensId?: string;

  @ApiPropertyOptional({ description: 'Selected coatings', example: ['anti_reflective', 'blue_light'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedCoatings?: string[];

  @ApiPropertyOptional({ description: 'Frame price' })
  @IsOptional()
  @IsNumber()
  framePrice?: number;

  @ApiPropertyOptional({ description: 'Lens price' })
  @IsOptional()
  @IsNumber()
  lensPrice?: number;

  @ApiPropertyOptional({ description: 'Coating price' })
  @IsOptional()
  @IsNumber()
  coatingPrice?: number;

  @ApiPropertyOptional({ description: 'Fitting charge' })
  @IsOptional()
  @IsNumber()
  fittingCharge?: number;

  @ApiPropertyOptional({ description: 'Discount amount', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ description: 'Fitting notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fittingNotes?: string;

  @ApiPropertyOptional({ description: 'Lab notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  labNotes?: string;

  @ApiPropertyOptional({ description: 'Estimated ready date' })
  @IsOptional()
  @IsDateString()
  estimatedReady?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Order status',
    enum: ['ordered', 'in_lab', 'lens_cutting', 'fitting', 'quality_check', 'ready', 'delivered', 'returned'],
  })
  @IsString()
  @IsEnum(['ordered', 'in_lab', 'lens_cutting', 'fitting', 'quality_check', 'ready', 'delivered', 'returned'])
  status: string;

  @ApiPropertyOptional({ description: 'Status update notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ============ VISUAL FIELD TEST ============

export class CreateVisualFieldTestDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  patientId: string;

  @ApiProperty({
    description: 'Test type',
    enum: ['humphrey', 'goldmann', 'confrontation', 'amsler'],
  })
  @IsString()
  @IsEnum(['humphrey', 'goldmann', 'confrontation', 'amsler'])
  testType: string;

  @ApiProperty({ description: 'Eye tested', enum: ['od', 'os'] })
  @IsString()
  @IsEnum(['od', 'os'])
  eye: string;

  @ApiPropertyOptional({ description: 'Test strategy', example: 'SITA Standard' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  strategy?: string;

  @ApiPropertyOptional({ description: 'Test pattern', example: '24-2' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  pattern?: string;

  @ApiPropertyOptional({ description: 'Mean deviation (dB)' })
  @IsOptional()
  @IsNumber()
  meanDeviation?: number;

  @ApiPropertyOptional({ description: 'Pattern standard deviation (dB)' })
  @IsOptional()
  @IsNumber()
  patternStandardDeviation?: number;

  @ApiPropertyOptional({ description: 'Visual Field Index (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  vfi?: number;

  @ApiPropertyOptional({ description: 'False positives (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  falsePositives?: number;

  @ApiPropertyOptional({ description: 'False negatives (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  falseNegatives?: number;

  @ApiPropertyOptional({ description: 'Fixation losses (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fixationLosses?: number;

  @ApiPropertyOptional({
    description: 'Test reliability',
    enum: ['reliable', 'borderline', 'unreliable'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['reliable', 'borderline', 'unreliable'])
  reliability?: string;

  @ApiPropertyOptional({ description: 'Interpretation of results' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  interpretation?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
