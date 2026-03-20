import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ItemCategory,
  ItemSubcategory,
  ItemBrand,
  ItemTag,
  ItemUnit,
  ItemFormulation,
  ItemStrength,
  StorageCondition,
} from '../../database/entities/item-classification.entity';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSubcategoryDto,
  UpdateSubcategoryDto,
  CreateBrandDto,
  UpdateBrandDto,
  CreateTagDto,
  UpdateTagDto,
  CreateUnitDto,
  UpdateUnitDto,
  CreateFormulationDto,
  UpdateFormulationDto,
  CreateStrengthDto,
  UpdateStrengthDto,
  CreateStorageConditionDto,
  UpdateStorageConditionDto,
} from './item-classifications.dto';

@Injectable()
export class ItemClassificationsService {
  constructor(
    @InjectRepository(ItemCategory)
    private categoryRepo: Repository<ItemCategory>,
    @InjectRepository(ItemSubcategory)
    private subcategoryRepo: Repository<ItemSubcategory>,
    @InjectRepository(ItemBrand)
    private brandRepo: Repository<ItemBrand>,
    @InjectRepository(ItemTag)
    private tagRepo: Repository<ItemTag>,
    @InjectRepository(ItemUnit)
    private unitRepo: Repository<ItemUnit>,
    @InjectRepository(ItemFormulation)
    private formulationRepo: Repository<ItemFormulation>,
    @InjectRepository(ItemStrength)
    private strengthRepo: Repository<ItemStrength>,
    @InjectRepository(StorageCondition)
    private storageRepo: Repository<StorageCondition>,
  ) {}

  // ============ CATEGORIES ============
  async createCategory(dto: CreateCategoryDto, tenantId?: string): Promise<ItemCategory> {
    // Auto-generate code from name if not provided
    if (!dto.code || !dto.code.trim()) {
      dto.code = await this.generateCategoryCode(dto.name, dto.facilityId, tenantId);
    }

    const existing = await this.categoryRepo.findOne({
      where: { facilityId: dto.facilityId, code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) throw new ConflictException(`Category with code ${dto.code} already exists`);

    const category = this.categoryRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.categoryRepo.save(category);
  }

  private async generateCategoryCode(name: string, facilityId: string, tenantId?: string): Promise<string> {
    // Create code from first 3 chars of name uppercased, e.g. "Antibiotics" -> "ANT"
    const prefix = name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'CAT';
    let code = prefix;
    let counter = 1;
    while (true) {
      const existing = await this.categoryRepo.findOne({
        where: { facilityId, code, ...(tenantId ? { tenantId } : {}) },
      });
      if (!existing) return code;
      code = `${prefix}${counter}`;
      counter++;
    }
  }

  async getCategories(facilityId: string, includeInactive = false, tenantId?: string) {
    const where: any = {};
    if (facilityId && facilityId.trim() !== '') {
      where.facilityId = facilityId;
    }
    if (!includeInactive) {
      where.isActive = true;
    }
    if (tenantId) where.tenantId = tenantId;
    return this.categoryRepo.find({
      where,
      relations: ['subcategories'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async getCategory(id: string, tenantId?: string): Promise<ItemCategory> {
    const category = await this.categoryRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['subcategories'],
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, tenantId?: string): Promise<ItemCategory> {
    const category = await this.getCategory(id, tenantId);
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string, tenantId?: string): Promise<void> {
    const category = await this.getCategory(id, tenantId);
    await this.categoryRepo.softRemove(category);
  }

  // ============ SUBCATEGORIES ============
  async createSubcategory(dto: CreateSubcategoryDto, tenantId?: string): Promise<ItemSubcategory> {
    const existing = await this.subcategoryRepo.findOne({
      where: { categoryId: dto.categoryId, code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) throw new ConflictException(`Subcategory with code ${dto.code} already exists`);

    const subcategory = this.subcategoryRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.subcategoryRepo.save(subcategory);
  }

  async getSubcategories(categoryId: string, includeInactive = false, tenantId?: string) {
    const where: any = { categoryId };
    if (!includeInactive) {
      where.isActive = true;
    }
    if (tenantId) where.tenantId = tenantId;
    return this.subcategoryRepo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async updateSubcategory(id: string, dto: UpdateSubcategoryDto, tenantId?: string): Promise<ItemSubcategory> {
    const subcategory = await this.subcategoryRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!subcategory) throw new NotFoundException('Subcategory not found');
    Object.assign(subcategory, dto);
    return this.subcategoryRepo.save(subcategory);
  }

  async deleteSubcategory(id: string, tenantId?: string): Promise<void> {
    const subcategory = await this.subcategoryRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!subcategory) throw new NotFoundException('Subcategory not found');
    await this.subcategoryRepo.softRemove(subcategory);
  }

  // ============ BRANDS ============
  async createBrand(dto: CreateBrandDto, tenantId?: string): Promise<ItemBrand> {
    const existing = await this.brandRepo.findOne({
      where: { facilityId: dto.facilityId, code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) throw new ConflictException(`Brand with code ${dto.code} already exists`);

    const brand = this.brandRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.brandRepo.save(brand);
  }

  async getBrands(facilityId: string, includeInactive = false, tenantId?: string) {
    const where: any = {};
    if (facilityId && facilityId.trim() !== '') {
      where.facilityId = facilityId;
    }
    if (!includeInactive) {
      where.isActive = true;
    }
    if (tenantId) where.tenantId = tenantId;
    return this.brandRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async updateBrand(id: string, dto: UpdateBrandDto, tenantId?: string): Promise<ItemBrand> {
    const brand = await this.brandRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!brand) throw new NotFoundException('Brand not found');
    Object.assign(brand, dto);
    return this.brandRepo.save(brand);
  }

  async deleteBrand(id: string, tenantId?: string): Promise<void> {
    const brand = await this.brandRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!brand) throw new NotFoundException('Brand not found');
    await this.brandRepo.softRemove(brand);
  }

  // ============ TAGS ============
  async createTag(dto: CreateTagDto, tenantId?: string): Promise<ItemTag> {
    const existing = await this.tagRepo.findOne({
      where: { facilityId: dto.facilityId, code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) throw new ConflictException(`Tag with code ${dto.code} already exists`);

    const tag = this.tagRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.tagRepo.save(tag);
  }

  async getTags(facilityId: string, tagType?: string, includeInactive = false, tenantId?: string) {
    const where: any = {};
    if (facilityId && facilityId.trim() !== '') {
      where.facilityId = facilityId;
    }
    if (tagType) {
      where.tagType = tagType;
    }
    if (!includeInactive) {
      where.isActive = true;
    }
    if (tenantId) where.tenantId = tenantId;
    return this.tagRepo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async updateTag(id: string, dto: UpdateTagDto, tenantId?: string): Promise<ItemTag> {
    const tag = await this.tagRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!tag) throw new NotFoundException('Tag not found');
    Object.assign(tag, dto);
    return this.tagRepo.save(tag);
  }

  async deleteTag(id: string, tenantId?: string): Promise<void> {
    const tag = await this.tagRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.tagRepo.softRemove(tag);
  }

  // ============ UNITS ============
  async createUnit(dto: CreateUnitDto, tenantId?: string): Promise<ItemUnit> {
    const existing = await this.unitRepo.findOne({
      where: { facilityId: dto.facilityId, code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) throw new ConflictException(`Unit with code ${dto.code} already exists`);

    const unit = this.unitRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.unitRepo.save(unit);
  }

  async getUnits(facilityId: string, includeInactive = false, tenantId?: string) {
    const where: any = {};
    if (facilityId && facilityId.trim() !== '') {
      where.facilityId = facilityId;
    }
    if (!includeInactive) {
      where.isActive = true;
    }
    if (tenantId) where.tenantId = tenantId;
    return this.unitRepo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async updateUnit(id: string, dto: UpdateUnitDto, tenantId?: string): Promise<ItemUnit> {
    const unit = await this.unitRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!unit) throw new NotFoundException('Unit not found');
    Object.assign(unit, dto);
    return this.unitRepo.save(unit);
  }

  async deleteUnit(id: string, tenantId?: string): Promise<void> {
    const unit = await this.unitRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!unit) throw new NotFoundException('Unit not found');
    await this.unitRepo.softRemove(unit);
  }

  // ============ FORMULATIONS ============
  async createFormulation(dto: CreateFormulationDto, tenantId?: string): Promise<ItemFormulation> {
    const existing = await this.formulationRepo.findOne({
      where: { facilityId: dto.facilityId, code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) throw new ConflictException(`Formulation with code ${dto.code} already exists`);

    const formulation = this.formulationRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.formulationRepo.save(formulation);
  }

  async getFormulations(facilityId: string, includeInactive = false, tenantId?: string) {
    const where: any = {};
    if (facilityId && facilityId.trim() !== '') {
      where.facilityId = facilityId;
    }
    if (!includeInactive) {
      where.isActive = true;
    }
    if (tenantId) where.tenantId = tenantId;
    return this.formulationRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async updateFormulation(id: string, dto: UpdateFormulationDto, tenantId?: string): Promise<ItemFormulation> {
    const formulation = await this.formulationRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!formulation) throw new NotFoundException('Formulation not found');
    Object.assign(formulation, dto);
    return this.formulationRepo.save(formulation);
  }

  async deleteFormulation(id: string, tenantId?: string): Promise<void> {
    const formulation = await this.formulationRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!formulation) throw new NotFoundException('Formulation not found');
    await this.formulationRepo.softRemove(formulation);
  }

  // ============ STRENGTHS ============
  async createStrength(dto: CreateStrengthDto, tenantId?: string): Promise<ItemStrength> {
    const existing = await this.strengthRepo.findOne({
      where: { facilityId: dto.facilityId, code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) throw new ConflictException(`Strength with code ${dto.code} already exists`);

    const strength = this.strengthRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.strengthRepo.save(strength);
  }

  async getStrengths(facilityId: string, includeInactive = false, tenantId?: string) {
    const where: any = {};
    if (facilityId && facilityId.trim() !== '') {
      where.facilityId = facilityId;
    }
    if (!includeInactive) {
      where.isActive = true;
    }
    if (tenantId) where.tenantId = tenantId;
    return this.strengthRepo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async updateStrength(id: string, dto: UpdateStrengthDto, tenantId?: string): Promise<ItemStrength> {
    const strength = await this.strengthRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!strength) throw new NotFoundException('Strength not found');
    Object.assign(strength, dto);
    return this.strengthRepo.save(strength);
  }

  async deleteStrength(id: string, tenantId?: string): Promise<void> {
    const strength = await this.strengthRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!strength) throw new NotFoundException('Strength not found');
    await this.strengthRepo.softRemove(strength);
  }

  // ============ STORAGE CONDITIONS ============
  async createStorageCondition(dto: CreateStorageConditionDto, tenantId?: string): Promise<StorageCondition> {
    const existing = await this.storageRepo.findOne({
      where: { facilityId: dto.facilityId, code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) throw new ConflictException(`Storage condition with code ${dto.code} already exists`);

    const storage = this.storageRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.storageRepo.save(storage);
  }

  async getStorageConditions(facilityId: string, includeInactive = false, tenantId?: string) {
    const where: any = {};
    if (facilityId && facilityId.trim() !== '') {
      where.facilityId = facilityId;
    }
    if (!includeInactive) {
      where.isActive = true;
    }
    if (tenantId) where.tenantId = tenantId;
    return this.storageRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async updateStorageCondition(id: string, dto: UpdateStorageConditionDto, tenantId?: string): Promise<StorageCondition> {
    const storage = await this.storageRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!storage) throw new NotFoundException('Storage condition not found');
    Object.assign(storage, dto);
    return this.storageRepo.save(storage);
  }

  async deleteStorageCondition(id: string, tenantId?: string): Promise<void> {
    const storage = await this.storageRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!storage) throw new NotFoundException('Storage condition not found');
    await this.storageRepo.softRemove(storage);
  }

  // ============ BULK OPERATIONS / SEEDING ============
  async seedDefaultClassifications(facilityId: string, tenantId?: string) {
    // Validate facilityId
    if (!facilityId || facilityId.trim() === '') {
      throw new ConflictException('facilityId is required for seeding defaults');
    }

    // Seed default categories
    const defaultCategories = [
      { code: 'MEDICATIONS', name: 'Medications', isDrugCategory: true, requiresPrescription: true, color: '#3B82F6' },
      { code: 'EQUIPMENT', name: 'Medical Equipment', isDrugCategory: false, color: '#10B981' },
      { code: 'REAGENTS', name: 'Laboratory Reagents', isDrugCategory: false, requiresBatchTracking: true, color: '#8B5CF6' },
      { code: 'SUPPLIES', name: 'Medical Supplies', isDrugCategory: false, color: '#F59E0B' },
      { code: 'CONSUMABLES', name: 'Consumables', isDrugCategory: false, color: '#EC4899' },
      { code: 'SURGICAL', name: 'Surgical Supplies', isDrugCategory: false, color: '#EF4444' },
    ];

    for (const cat of defaultCategories) {
      try {
        await this.createCategory({ facilityId, ...cat }, tenantId);
      } catch (e) {
        // Skip if already exists
      }
    }

    // Seed default units
    const defaultUnits = [
      { code: 'TAB', name: 'Tablet', abbreviation: 'tab', isBaseUnit: true },
      { code: 'CAP', name: 'Capsule', abbreviation: 'cap', isBaseUnit: true },
      { code: 'BTL', name: 'Bottle', abbreviation: 'btl', isBaseUnit: false },
      { code: 'BOX', name: 'Box', abbreviation: 'box', isBaseUnit: false },
      { code: 'PCS', name: 'Piece', abbreviation: 'pcs', isBaseUnit: true },
      { code: 'AMP', name: 'Ampoule', abbreviation: 'amp', isBaseUnit: true },
      { code: 'VIAL', name: 'Vial', abbreviation: 'vial', isBaseUnit: true },
      { code: 'PKT', name: 'Packet', abbreviation: 'pkt', isBaseUnit: false },
      { code: 'ML', name: 'Milliliter', abbreviation: 'ml', isBaseUnit: true },
      { code: 'L', name: 'Liter', abbreviation: 'L', isBaseUnit: false },
      { code: 'G', name: 'Gram', abbreviation: 'g', isBaseUnit: true },
      { code: 'KG', name: 'Kilogram', abbreviation: 'kg', isBaseUnit: false },
    ];

    for (const unit of defaultUnits) {
      try {
        await this.createUnit({ facilityId, ...unit }, tenantId);
      } catch (e) {
        // Skip if already exists
      }
    }

    // Seed default storage conditions
    const defaultStorage = [
      { code: 'ROOM', name: 'Room Temperature', minTemp: 15, maxTemp: 25, description: 'Store at room temperature (15-25°C)' },
      { code: 'REFRIG', name: 'Refrigerated', minTemp: 2, maxTemp: 8, description: 'Store in refrigerator (2-8°C)' },
      { code: 'FROZEN', name: 'Frozen', maxTemp: -15, description: 'Store frozen (below -15°C)' },
      { code: 'COOL', name: 'Cool Place', minTemp: 8, maxTemp: 15, description: 'Store in a cool place (8-15°C)' },
      { code: 'DRY', name: 'Dry Place', description: 'Store in a dry place, protected from moisture' },
      { code: 'LIGHT', name: 'Protect from Light', description: 'Store protected from light' },
    ];

    for (const storage of defaultStorage) {
      try {
        await this.createStorageCondition({ facilityId, ...storage }, tenantId);
      } catch (e) {
        // Skip if already exists
      }
    }

    // Seed default tags
    const defaultTags = [
      { code: 'HIGH_ALERT', name: 'High Alert', color: '#EF4444', tagType: 'safety', isWarning: true },
      { code: 'CONTROLLED', name: 'Controlled Substance', color: '#F59E0B', tagType: 'regulatory', isWarning: true },
      { code: 'NARCOTIC', name: 'Narcotic', color: '#DC2626', tagType: 'regulatory', isWarning: true },
      { code: 'LASA', name: 'Look-Alike Sound-Alike', color: '#8B5CF6', tagType: 'safety', isWarning: true },
      { code: 'COLD_CHAIN', name: 'Cold Chain', color: '#06B6D4', tagType: 'storage' },
      { code: 'HAZARDOUS', name: 'Hazardous Material', color: '#EF4444', tagType: 'safety', isWarning: true },
      { code: 'ESSENTIAL', name: 'Essential Medicine', color: '#10B981', tagType: 'general' },
    ];

    for (const tag of defaultTags) {
      try {
        await this.createTag({ facilityId, ...tag }, tenantId);
      } catch (e) {
        // Skip if already exists
      }
    }

    // Seed default formulations
    const defaultFormulations = [
      { code: 'TABLET', name: 'Tablet', routeOfAdmin: 'oral' },
      { code: 'CAPSULE', name: 'Capsule', routeOfAdmin: 'oral' },
      { code: 'SYRUP', name: 'Syrup', routeOfAdmin: 'oral' },
      { code: 'INJECTION', name: 'Injection', routeOfAdmin: 'iv' },
      { code: 'CREAM', name: 'Cream', routeOfAdmin: 'topical' },
      { code: 'OINTMENT', name: 'Ointment', routeOfAdmin: 'topical' },
      { code: 'DROPS', name: 'Drops', routeOfAdmin: 'ophthalmic' },
      { code: 'SUSPENSION', name: 'Suspension', routeOfAdmin: 'oral' },
      { code: 'SUPPOSITORY', name: 'Suppository', routeOfAdmin: 'rectal' },
      { code: 'INHALER', name: 'Inhaler', routeOfAdmin: 'inhalation' },
    ];

    for (const form of defaultFormulations) {
      try {
        await this.createFormulation({ facilityId, ...form }, tenantId);
      } catch (e) {
        // Skip if already exists
      }
    }

    // Seed default strengths
    const defaultStrengths = [
      { code: '5MG', name: '5mg', value: '5', unit: 'mg' },
      { code: '10MG', name: '10mg', value: '10', unit: 'mg' },
      { code: '25MG', name: '25mg', value: '25', unit: 'mg' },
      { code: '50MG', name: '50mg', value: '50', unit: 'mg' },
      { code: '100MG', name: '100mg', value: '100', unit: 'mg' },
      { code: '125MG', name: '125mg', value: '125', unit: 'mg' },
      { code: '200MG', name: '200mg', value: '200', unit: 'mg' },
      { code: '250MG', name: '250mg', value: '250', unit: 'mg' },
      { code: '400MG', name: '400mg', value: '400', unit: 'mg' },
      { code: '500MG', name: '500mg', value: '500', unit: 'mg' },
      { code: '1G', name: '1g', value: '1000', unit: 'mg' },
      { code: '5ML', name: '5ml', value: '5', unit: 'ml' },
      { code: '10ML', name: '10ml', value: '10', unit: 'ml' },
      { code: '100ML', name: '100ml', value: '100', unit: 'ml' },
      { code: '250ML', name: '250ml', value: '250', unit: 'ml' },
      { code: '500ML', name: '500ml', value: '500', unit: 'ml' },
      { code: '5MG_ML', name: '5mg/ml', value: '5', unit: 'mg/ml' },
      { code: '10MG_ML', name: '10mg/ml', value: '10', unit: 'mg/ml' },
      { code: '1PCT', name: '1%', value: '1', unit: '%' },
      { code: '5PCT', name: '5%', value: '5', unit: '%' },
    ];

    for (const str of defaultStrengths) {
      try {
        await this.createStrength({ facilityId, ...str }, tenantId);
      } catch (e) {
        // Skip if already exists
      }
    }

    return { message: 'Default classifications seeded successfully' };
  }
}
