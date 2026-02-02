import api from './api';

// Types for classification entities
export interface ItemCategory {
  id: string;
  facilityId: string;
  name: string;
  code: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemSubcategory {
  id: string;
  facilityId: string;
  categoryId: string;
  category?: ItemCategory;
  name: string;
  code: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemBrand {
  id: string;
  facilityId: string;
  name: string;
  code: string;
  manufacturer?: string;
  country?: string;
  website?: string;
  isPreferred: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemTag {
  id: string;
  facilityId: string;
  name: string;
  code: string;
  color?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemUnit {
  id: string;
  facilityId: string;
  name: string;
  abbreviation: string;
  description?: string;
  baseUnit?: string;
  conversionFactor: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemFormulation {
  id: string;
  facilityId: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StorageCondition {
  id: string;
  facilityId: string;
  name: string;
  code: string;
  description?: string;
  minTemp?: number;
  maxTemp?: number;
  humidity?: string;
  specialInstructions?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Create DTOs
export interface CreateCategoryDto {
  name: string;
  code: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface CreateSubcategoryDto {
  categoryId: string;
  name: string;
  code: string;
  description?: string;
  sortOrder?: number;
}

export interface CreateBrandDto {
  name: string;
  code: string;
  manufacturer?: string;
  country?: string;
  website?: string;
  isPreferred?: boolean;
}

export interface CreateTagDto {
  name: string;
  code: string;
  color?: string;
  description?: string;
}

export interface CreateUnitDto {
  name: string;
  abbreviation: string;
  description?: string;
  baseUnit?: string;
  conversionFactor?: number;
}

export interface CreateFormulationDto {
  name: string;
  code: string;
  description?: string;
}

export interface CreateStorageConditionDto {
  name: string;
  code: string;
  description?: string;
  minTemp?: number;
  maxTemp?: number;
  humidity?: string;
  specialInstructions?: string;
}

const BASE_PATH = '/item-classifications';

// Categories
export const categoryService = {
  list: async (facilityId: string): Promise<ItemCategory[]> => {
    const { data } = await api.get(`${BASE_PATH}/categories`, { params: { facilityId } });
    return data;
  },
  create: async (facilityId: string, dto: CreateCategoryDto): Promise<ItemCategory> => {
    const { data } = await api.post(`${BASE_PATH}/categories`, dto, { params: { facilityId } });
    return data;
  },
  update: async (id: string, dto: Partial<CreateCategoryDto>): Promise<ItemCategory> => {
    const { data } = await api.put(`${BASE_PATH}/categories/${id}`, dto);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_PATH}/categories/${id}`);
  },
};

// Subcategories
export const subcategoryService = {
  list: async (facilityId: string, categoryId?: string): Promise<ItemSubcategory[]> => {
    const { data } = await api.get(`${BASE_PATH}/subcategories`, { 
      params: { facilityId, categoryId } 
    });
    return data;
  },
  create: async (facilityId: string, dto: CreateSubcategoryDto): Promise<ItemSubcategory> => {
    const { data } = await api.post(`${BASE_PATH}/subcategories`, dto, { params: { facilityId } });
    return data;
  },
  update: async (id: string, dto: Partial<CreateSubcategoryDto>): Promise<ItemSubcategory> => {
    const { data } = await api.put(`${BASE_PATH}/subcategories/${id}`, dto);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_PATH}/subcategories/${id}`);
  },
};

// Brands
export const brandService = {
  list: async (facilityId: string): Promise<ItemBrand[]> => {
    const { data } = await api.get(`${BASE_PATH}/brands`, { params: { facilityId } });
    return data;
  },
  create: async (facilityId: string, dto: CreateBrandDto): Promise<ItemBrand> => {
    const { data } = await api.post(`${BASE_PATH}/brands`, dto, { params: { facilityId } });
    return data;
  },
  update: async (id: string, dto: Partial<CreateBrandDto>): Promise<ItemBrand> => {
    const { data } = await api.put(`${BASE_PATH}/brands/${id}`, dto);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_PATH}/brands/${id}`);
  },
};

// Tags
export const tagService = {
  list: async (facilityId: string): Promise<ItemTag[]> => {
    const { data } = await api.get(`${BASE_PATH}/tags`, { params: { facilityId } });
    return data;
  },
  create: async (facilityId: string, dto: CreateTagDto): Promise<ItemTag> => {
    const { data } = await api.post(`${BASE_PATH}/tags`, dto, { params: { facilityId } });
    return data;
  },
  update: async (id: string, dto: Partial<CreateTagDto>): Promise<ItemTag> => {
    const { data } = await api.put(`${BASE_PATH}/tags/${id}`, dto);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_PATH}/tags/${id}`);
  },
};

// Units
export const unitService = {
  list: async (facilityId: string): Promise<ItemUnit[]> => {
    const { data } = await api.get(`${BASE_PATH}/units`, { params: { facilityId } });
    return data;
  },
  create: async (facilityId: string, dto: CreateUnitDto): Promise<ItemUnit> => {
    const { data } = await api.post(`${BASE_PATH}/units`, dto, { params: { facilityId } });
    return data;
  },
  update: async (id: string, dto: Partial<CreateUnitDto>): Promise<ItemUnit> => {
    const { data } = await api.put(`${BASE_PATH}/units/${id}`, dto);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_PATH}/units/${id}`);
  },
};

// Formulations
export const formulationService = {
  list: async (facilityId: string): Promise<ItemFormulation[]> => {
    const { data } = await api.get(`${BASE_PATH}/formulations`, { params: { facilityId } });
    return data;
  },
  create: async (facilityId: string, dto: CreateFormulationDto): Promise<ItemFormulation> => {
    const { data } = await api.post(`${BASE_PATH}/formulations`, dto, { params: { facilityId } });
    return data;
  },
  update: async (id: string, dto: Partial<CreateFormulationDto>): Promise<ItemFormulation> => {
    const { data } = await api.put(`${BASE_PATH}/formulations/${id}`, dto);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_PATH}/formulations/${id}`);
  },
};

// Storage Conditions
export const storageConditionService = {
  list: async (facilityId: string): Promise<StorageCondition[]> => {
    const { data } = await api.get(`${BASE_PATH}/storage-conditions`, { params: { facilityId } });
    return data;
  },
  create: async (facilityId: string, dto: CreateStorageConditionDto): Promise<StorageCondition> => {
    const { data } = await api.post(`${BASE_PATH}/storage-conditions`, dto, { params: { facilityId } });
    return data;
  },
  update: async (id: string, dto: Partial<CreateStorageConditionDto>): Promise<StorageCondition> => {
    const { data } = await api.put(`${BASE_PATH}/storage-conditions/${id}`, dto);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_PATH}/storage-conditions/${id}`);
  },
};

// Seed defaults
export const seedDefaults = async (facilityId: string): Promise<void> => {
  await api.post(`${BASE_PATH}/seed-defaults`, null, { params: { facilityId } });
};
