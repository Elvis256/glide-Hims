import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorRating, VendorRatingSummary } from '../../database/entities/vendor-rating.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { CreateVendorRatingDto, UpdateVendorRatingDto } from './dto/vendor-rating.dto';

@Injectable()
export class VendorRatingsService {
  private readonly logger = new Logger(VendorRatingsService.name);

  constructor(
    @InjectRepository(VendorRating) private ratingRepo: Repository<VendorRating>,
    @InjectRepository(VendorRatingSummary) private summaryRepo: Repository<VendorRatingSummary>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
  ) {}

  async create(dto: CreateVendorRatingDto, userId: string): Promise<VendorRating> {
    const overall = (dto.deliveryTimeRating + dto.qualityRating + dto.priceRating + dto.serviceRating) / 4;

    const rating = this.ratingRepo.create({
      supplierId: dto.supplierId,
      facilityId: dto.facilityId,
      purchaseOrderId: dto.purchaseOrderId,
      deliveryTimeRating: dto.deliveryTimeRating,
      qualityRating: dto.qualityRating,
      priceRating: dto.priceRating,
      serviceRating: dto.serviceRating,
      overallRating: overall,
      comments: dto.comments,
      ratedById: userId,
    });

    const saved = await this.ratingRepo.save(rating);
    await this.updateSummary(dto.supplierId);
    return this.findOne(saved.id);
  }

  async findAll(facilityId: string, options: { supplierId?: string } = {}) {
    const qb = this.ratingRepo
      .createQueryBuilder('rating')
      .leftJoinAndSelect('rating.supplier', 'supplier')
      .leftJoinAndSelect('rating.purchaseOrder', 'purchaseOrder')
      .leftJoinAndSelect('rating.ratedBy', 'ratedBy')
      .where('rating.facilityId = :facilityId', { facilityId });

    if (options.supplierId) {
      qb.andWhere('rating.supplierId = :supplierId', { supplierId: options.supplierId });
    }

    return qb.orderBy('rating.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<VendorRating> {
    const rating = await this.ratingRepo.findOne({
      where: { id },
      relations: ['supplier', 'purchaseOrder', 'ratedBy'],
    });
    if (!rating) throw new NotFoundException('Rating not found');
    return rating;
  }

  async update(id: string, dto: UpdateVendorRatingDto): Promise<VendorRating> {
    const rating = await this.findOne(id);
    
    if (dto.deliveryTimeRating !== undefined) rating.deliveryTimeRating = dto.deliveryTimeRating;
    if (dto.qualityRating !== undefined) rating.qualityRating = dto.qualityRating;
    if (dto.priceRating !== undefined) rating.priceRating = dto.priceRating;
    if (dto.serviceRating !== undefined) rating.serviceRating = dto.serviceRating;
    if (dto.comments !== undefined) rating.comments = dto.comments;

    rating.overallRating = (
      Number(rating.deliveryTimeRating) + 
      Number(rating.qualityRating) + 
      Number(rating.priceRating) + 
      Number(rating.serviceRating)
    ) / 4;

    await this.ratingRepo.save(rating);
    await this.updateSummary(rating.supplierId);
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    const rating = await this.findOne(id);
    await this.ratingRepo.softDelete(id);
    await this.updateSummary(rating.supplierId);
  }

  async getSummary(supplierId: string): Promise<VendorRatingSummary | null> {
    return this.summaryRepo.findOne({
      where: { supplierId },
      relations: ['supplier'],
    });
  }

  async getAllSummaries() {
    return this.summaryRepo.find({
      relations: ['supplier'],
      order: { avgOverall: 'DESC' },
    });
  }

  async getTopVendors(limit: number = 10) {
    return this.summaryRepo.find({
      relations: ['supplier'],
      order: { avgOverall: 'DESC' },
      take: limit,
    });
  }

  private async updateSummary(supplierId: string): Promise<void> {
    const ratings = await this.ratingRepo.find({ where: { supplierId } });

    if (ratings.length === 0) {
      await this.summaryRepo.delete({ supplierId });
      return;
    }

    const avgDeliveryTime = ratings.reduce((sum, r) => sum + Number(r.deliveryTimeRating), 0) / ratings.length;
    const avgQuality = ratings.reduce((sum, r) => sum + Number(r.qualityRating), 0) / ratings.length;
    const avgPrice = ratings.reduce((sum, r) => sum + Number(r.priceRating), 0) / ratings.length;
    const avgService = ratings.reduce((sum, r) => sum + Number(r.serviceRating), 0) / ratings.length;
    const avgOverall = (avgDeliveryTime + avgQuality + avgPrice + avgService) / 4;

    let summary = await this.summaryRepo.findOne({ where: { supplierId } });

    // Determine trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (summary) {
      const prevOverall = Number(summary.avgOverall);
      if (avgOverall > prevOverall + 0.1) trend = 'up';
      else if (avgOverall < prevOverall - 0.1) trend = 'down';
    }

    if (summary) {
      summary.totalReviews = ratings.length;
      summary.avgDeliveryTime = avgDeliveryTime;
      summary.avgQuality = avgQuality;
      summary.avgPrice = avgPrice;
      summary.avgService = avgService;
      summary.avgOverall = avgOverall;
      summary.lastReviewDate = new Date();
      summary.trend = trend;
    } else {
      summary = this.summaryRepo.create({
        supplierId,
        totalReviews: ratings.length,
        avgDeliveryTime,
        avgQuality,
        avgPrice,
        avgService,
        avgOverall,
        lastReviewDate: new Date(),
        trend: 'stable',
      });
    }

    await this.summaryRepo.save(summary);
  }
}
