import { DataSource } from 'typeorm';
import { ChartOfAccount, AccountType, AccountCategory } from '../entities/chart-of-account.entity';
import { Facility } from '../entities/facility.entity';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'glide_hims',
  password: process.env.DB_PASSWORD || 'glide_hims_dev',
  database: process.env.DB_NAME || 'glide_hims_dev',
  entities: [ChartOfAccount, Facility, Tenant, User, Role, Permission],
  synchronize: false,
});

async function seedChartOfAccounts() {
  await dataSource.initialize();
  console.log('Connected to database');

  const accountRepo = dataSource.getRepository(ChartOfAccount);
  const facilityRepo = dataSource.getRepository(Facility);

  const facility = await facilityRepo.findOne({ where: {} });
  if (!facility) {
    console.error('No facility found. Run main seed first.');
    await dataSource.destroy();
    return;
  }

  const accounts = [
    // ASSETS (1xxx)
    { code: '1000', name: 'Assets', type: AccountType.ASSET, category: AccountCategory.CASH, isHeader: true },
    { code: '1100', name: 'Cash and Bank', type: AccountType.ASSET, category: AccountCategory.CASH, isHeader: true },
    { code: '1101', name: 'Petty Cash', type: AccountType.ASSET, category: AccountCategory.CASH },
    { code: '1102', name: 'Cash Register', type: AccountType.ASSET, category: AccountCategory.CASH },
    { code: '1110', name: 'Bank - Stanbic Current', type: AccountType.ASSET, category: AccountCategory.BANK },
    { code: '1111', name: 'Bank - Centenary Current', type: AccountType.ASSET, category: AccountCategory.BANK },
    { code: '1200', name: 'Accounts Receivable', type: AccountType.ASSET, category: AccountCategory.RECEIVABLES, isHeader: true },
    { code: '1201', name: 'Patient Receivables', type: AccountType.ASSET, category: AccountCategory.RECEIVABLES },
    { code: '1202', name: 'Insurance Receivables', type: AccountType.ASSET, category: AccountCategory.RECEIVABLES },
    { code: '1203', name: 'Government Receivables', type: AccountType.ASSET, category: AccountCategory.RECEIVABLES },
    { code: '1300', name: 'Inventory', type: AccountType.ASSET, category: AccountCategory.INVENTORY, isHeader: true },
    { code: '1301', name: 'Pharmacy Stock', type: AccountType.ASSET, category: AccountCategory.INVENTORY },
    { code: '1302', name: 'Medical Supplies', type: AccountType.ASSET, category: AccountCategory.INVENTORY },
    { code: '1303', name: 'Lab Reagents', type: AccountType.ASSET, category: AccountCategory.INVENTORY },
    { code: '1400', name: 'Fixed Assets', type: AccountType.ASSET, category: AccountCategory.FIXED_ASSETS, isHeader: true },
    { code: '1401', name: 'Medical Equipment', type: AccountType.ASSET, category: AccountCategory.FIXED_ASSETS },
    { code: '1402', name: 'Furniture & Fixtures', type: AccountType.ASSET, category: AccountCategory.FIXED_ASSETS },
    { code: '1403', name: 'Vehicles', type: AccountType.ASSET, category: AccountCategory.FIXED_ASSETS },
    { code: '1404', name: 'Buildings', type: AccountType.ASSET, category: AccountCategory.FIXED_ASSETS },
    { code: '1490', name: 'Accumulated Depreciation', type: AccountType.ASSET, category: AccountCategory.FIXED_ASSETS },

    // LIABILITIES (2xxx)
    { code: '2000', name: 'Liabilities', type: AccountType.LIABILITY, category: AccountCategory.PAYABLES, isHeader: true },
    { code: '2100', name: 'Accounts Payable', type: AccountType.LIABILITY, category: AccountCategory.PAYABLES, isHeader: true },
    { code: '2101', name: 'Supplier Payables', type: AccountType.LIABILITY, category: AccountCategory.PAYABLES },
    { code: '2102', name: 'Drug Supplier Payables', type: AccountType.LIABILITY, category: AccountCategory.PAYABLES },
    { code: '2200', name: 'Accrued Expenses', type: AccountType.LIABILITY, category: AccountCategory.ACCRUALS, isHeader: true },
    { code: '2201', name: 'Accrued Salaries', type: AccountType.LIABILITY, category: AccountCategory.ACCRUALS },
    { code: '2202', name: 'PAYE Payable', type: AccountType.LIABILITY, category: AccountCategory.ACCRUALS },
    { code: '2203', name: 'NSSF Payable', type: AccountType.LIABILITY, category: AccountCategory.ACCRUALS },
    { code: '2300', name: 'Loans', type: AccountType.LIABILITY, category: AccountCategory.LOANS, isHeader: true },
    { code: '2301', name: 'Bank Loan - Equipment', type: AccountType.LIABILITY, category: AccountCategory.LOANS },

    // EQUITY (3xxx)
    { code: '3000', name: 'Equity', type: AccountType.EQUITY, category: AccountCategory.CAPITAL, isHeader: true },
    { code: '3100', name: 'Capital', type: AccountType.EQUITY, category: AccountCategory.CAPITAL },
    { code: '3200', name: 'Retained Earnings', type: AccountType.EQUITY, category: AccountCategory.RETAINED_EARNINGS },
    { code: '3300', name: 'Current Year Earnings', type: AccountType.EQUITY, category: AccountCategory.RETAINED_EARNINGS },

    // REVENUE (4xxx)
    { code: '4000', name: 'Revenue', type: AccountType.REVENUE, category: AccountCategory.SERVICE_REVENUE, isHeader: true },
    { code: '4100', name: 'Medical Services', type: AccountType.REVENUE, category: AccountCategory.SERVICE_REVENUE, isHeader: true },
    { code: '4101', name: 'Consultation Fees', type: AccountType.REVENUE, category: AccountCategory.SERVICE_REVENUE },
    { code: '4102', name: 'Lab Services', type: AccountType.REVENUE, category: AccountCategory.SERVICE_REVENUE },
    { code: '4103', name: 'Radiology Services', type: AccountType.REVENUE, category: AccountCategory.SERVICE_REVENUE },
    { code: '4104', name: 'Pharmacy Sales', type: AccountType.REVENUE, category: AccountCategory.SERVICE_REVENUE },
    { code: '4105', name: 'Surgery Fees', type: AccountType.REVENUE, category: AccountCategory.SERVICE_REVENUE },
    { code: '4106', name: 'Maternity Services', type: AccountType.REVENUE, category: AccountCategory.SERVICE_REVENUE },
    { code: '4107', name: 'Ward/Bed Charges', type: AccountType.REVENUE, category: AccountCategory.SERVICE_REVENUE },
    { code: '4200', name: 'Other Income', type: AccountType.REVENUE, category: AccountCategory.OTHER_INCOME, isHeader: true },
    { code: '4201', name: 'Insurance Claims', type: AccountType.REVENUE, category: AccountCategory.OTHER_INCOME },
    { code: '4202', name: 'Government Grants', type: AccountType.REVENUE, category: AccountCategory.OTHER_INCOME },

    // EXPENSES (5xxx)
    { code: '5000', name: 'Expenses', type: AccountType.EXPENSE, category: AccountCategory.SALARIES, isHeader: true },
    { code: '5100', name: 'Salaries & Wages', type: AccountType.EXPENSE, category: AccountCategory.SALARIES, isHeader: true },
    { code: '5101', name: 'Medical Staff Salaries', type: AccountType.EXPENSE, category: AccountCategory.SALARIES },
    { code: '5102', name: 'Nursing Staff Salaries', type: AccountType.EXPENSE, category: AccountCategory.SALARIES },
    { code: '5103', name: 'Admin Staff Salaries', type: AccountType.EXPENSE, category: AccountCategory.SALARIES },
    { code: '5104', name: 'NSSF Employer Contribution', type: AccountType.EXPENSE, category: AccountCategory.SALARIES },
    { code: '5200', name: 'Medical Supplies', type: AccountType.EXPENSE, category: AccountCategory.SUPPLIES, isHeader: true },
    { code: '5201', name: 'Drug Costs', type: AccountType.EXPENSE, category: AccountCategory.SUPPLIES },
    { code: '5202', name: 'Lab Consumables', type: AccountType.EXPENSE, category: AccountCategory.SUPPLIES },
    { code: '5203', name: 'Medical Disposables', type: AccountType.EXPENSE, category: AccountCategory.SUPPLIES },
    { code: '5300', name: 'Utilities', type: AccountType.EXPENSE, category: AccountCategory.UTILITIES, isHeader: true },
    { code: '5301', name: 'Electricity - UMEME', type: AccountType.EXPENSE, category: AccountCategory.UTILITIES },
    { code: '5302', name: 'Water - NWSC', type: AccountType.EXPENSE, category: AccountCategory.UTILITIES },
    { code: '5303', name: 'Internet & Communications', type: AccountType.EXPENSE, category: AccountCategory.UTILITIES },
    { code: '5400', name: 'Depreciation', type: AccountType.EXPENSE, category: AccountCategory.DEPRECIATION, isHeader: true },
    { code: '5401', name: 'Depreciation - Equipment', type: AccountType.EXPENSE, category: AccountCategory.DEPRECIATION },
    { code: '5402', name: 'Depreciation - Vehicles', type: AccountType.EXPENSE, category: AccountCategory.DEPRECIATION },
    { code: '5500', name: 'Other Expenses', type: AccountType.EXPENSE, category: AccountCategory.OTHER_EXPENSE, isHeader: true },
    { code: '5501', name: 'Maintenance & Repairs', type: AccountType.EXPENSE, category: AccountCategory.OTHER_EXPENSE },
    { code: '5502', name: 'Insurance Expense', type: AccountType.EXPENSE, category: AccountCategory.OTHER_EXPENSE },
    { code: '5503', name: 'Bank Charges', type: AccountType.EXPENSE, category: AccountCategory.OTHER_EXPENSE },
    { code: '5504', name: 'Professional Fees', type: AccountType.EXPENSE, category: AccountCategory.OTHER_EXPENSE },
  ];

  let created = 0;
  for (const acc of accounts) {
    const existing = await accountRepo.findOne({
      where: { facilityId: facility.id, accountCode: acc.code },
    });
    if (!existing) {
      const account = accountRepo.create({
        facilityId: facility.id,
        accountCode: acc.code,
        accountName: acc.name,
        accountType: acc.type,
        accountCategory: acc.category,
        isHeader: acc.isHeader || false,
        isActive: true,
        currentBalance: 0,
      });
      await accountRepo.save(account);
      created++;
      console.log(`Created account: ${acc.code} - ${acc.name}`);
    }
  }

  console.log(`\n✅ Seeded ${created} accounts`);
  await dataSource.destroy();
}

seedChartOfAccounts().catch(console.error);
