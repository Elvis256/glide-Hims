import { DataSource } from 'typeorm';
import { Employee, Gender, MaritalStatus, EmploymentType, EmploymentStatus } from '../entities/employee.entity';
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
  entities: [Employee, Facility, Tenant, User, Role, Permission],
  synchronize: false,
});

async function seedEmployees() {
  await dataSource.initialize();
  console.log('Connected to database');

  const employeeRepo = dataSource.getRepository(Employee);
  const facilityRepo = dataSource.getRepository(Facility);

  // Get the main facility
  const facility = await facilityRepo.findOne({ where: {} });
  if (!facility) {
    console.error('No facility found. Run main seed first.');
    await dataSource.destroy();
    return;
  }

  const employees = [
    // Medical Staff
    {
      employeeNumber: 'EMP00001',
      firstName: 'James',
      lastName: 'Mukasa',
      dateOfBirth: new Date('1980-05-15'),
      gender: Gender.MALE,
      maritalStatus: MaritalStatus.MARRIED,
      nationalId: 'CM80123456ABCD',
      nssfNumber: 'NSSF12345678',
      tinNumber: '1000123456',
      phone: '+256700100001',
      email: 'james.mukasa@hospital.ug',
      address: 'Plot 45, Kampala Road, Kampala',
      jobTitle: 'Medical Officer',
      department: 'Medical',
      employmentType: EmploymentType.PERMANENT,
      hireDate: new Date('2015-03-01'),
      salaryGrade: 'M10',
      basicSalary: 4500000, // 4.5M UGX
      allowances: [
        { name: 'Housing', amount: 800000, taxable: true },
        { name: 'Transport', amount: 400000, taxable: false },
        { name: 'Medical', amount: 200000, taxable: false },
      ],
      bankName: 'Stanbic Bank',
      bankAccountNumber: '9030012345678',
      annualLeaveBalance: 21,
      sickLeaveBalance: 14,
    },
    {
      employeeNumber: 'EMP00002',
      firstName: 'Grace',
      lastName: 'Nambi',
      dateOfBirth: new Date('1988-09-22'),
      gender: Gender.FEMALE,
      maritalStatus: MaritalStatus.SINGLE,
      nationalId: 'CF88654321WXYZ',
      nssfNumber: 'NSSF23456789',
      tinNumber: '1000234567',
      phone: '+256700200002',
      email: 'grace.nambi@hospital.ug',
      address: 'Ntinda, Kampala',
      jobTitle: 'Senior Nurse',
      department: 'Nursing',
      employmentType: EmploymentType.PERMANENT,
      hireDate: new Date('2018-06-15'),
      salaryGrade: 'N7',
      basicSalary: 1800000,
      allowances: [
        { name: 'Housing', amount: 300000, taxable: true },
        { name: 'Transport', amount: 200000, taxable: false },
      ],
      bankName: 'DFCU Bank',
      bankAccountNumber: '0120012345678',
      annualLeaveBalance: 18,
      sickLeaveBalance: 12,
    },
    {
      employeeNumber: 'EMP00003',
      firstName: 'Peter',
      lastName: 'Ochieng',
      dateOfBirth: new Date('1975-12-10'),
      gender: Gender.MALE,
      maritalStatus: MaritalStatus.MARRIED,
      nationalId: 'CM75789012EFGH',
      nssfNumber: 'NSSF34567890',
      tinNumber: '1000345678',
      phone: '+256700300003',
      email: 'peter.ochieng@hospital.ug',
      address: 'Kololo, Kampala',
      jobTitle: 'Senior Medical Officer',
      department: 'Medical',
      employmentType: EmploymentType.PERMANENT,
      hireDate: new Date('2010-01-20'),
      salaryGrade: 'M12',
      basicSalary: 6500000,
      allowances: [
        { name: 'Housing', amount: 1200000, taxable: true },
        { name: 'Transport', amount: 600000, taxable: false },
        { name: 'Medical', amount: 300000, taxable: false },
        { name: 'Responsibility', amount: 500000, taxable: true },
      ],
      bankName: 'Centenary Bank',
      bankAccountNumber: '3120045678901',
      annualLeaveBalance: 28,
      sickLeaveBalance: 14,
    },
    {
      employeeNumber: 'EMP00004',
      firstName: 'Sarah',
      lastName: 'Atim',
      dateOfBirth: new Date('1992-03-25'),
      gender: Gender.FEMALE,
      maritalStatus: MaritalStatus.MARRIED,
      nationalId: 'CF92456789IJKL',
      nssfNumber: 'NSSF45678901',
      tinNumber: '1000456789',
      phone: '+256700400004',
      email: 'sarah.atim@hospital.ug',
      address: 'Bugolobi, Kampala',
      jobTitle: 'Lab Technician',
      department: 'Laboratory',
      employmentType: EmploymentType.PERMANENT,
      hireDate: new Date('2020-02-10'),
      salaryGrade: 'T5',
      basicSalary: 1200000,
      allowances: [
        { name: 'Housing', amount: 200000, taxable: true },
        { name: 'Transport', amount: 150000, taxable: false },
      ],
      bankName: 'Equity Bank',
      bankAccountNumber: '1010012345678',
      annualLeaveBalance: 15,
      sickLeaveBalance: 10,
    },
    {
      employeeNumber: 'EMP00005',
      firstName: 'John',
      lastName: 'Okello',
      dateOfBirth: new Date('1985-07-18'),
      gender: Gender.MALE,
      maritalStatus: MaritalStatus.SINGLE,
      nationalId: 'CM85123789MNOP',
      nssfNumber: 'NSSF56789012',
      tinNumber: '1000567890',
      phone: '+256700500005',
      email: 'john.okello@hospital.ug',
      address: 'Nakasero, Kampala',
      jobTitle: 'Pharmacist',
      department: 'Pharmacy',
      employmentType: EmploymentType.PERMANENT,
      hireDate: new Date('2017-08-01'),
      salaryGrade: 'P6',
      basicSalary: 2200000,
      allowances: [
        { name: 'Housing', amount: 400000, taxable: true },
        { name: 'Transport', amount: 250000, taxable: false },
      ],
      bankName: 'Bank of Africa',
      bankAccountNumber: '2020023456789',
      annualLeaveBalance: 20,
      sickLeaveBalance: 12,
    },
    {
      employeeNumber: 'EMP00006',
      firstName: 'Mary',
      lastName: 'Namutebi',
      dateOfBirth: new Date('1990-11-05'),
      gender: Gender.FEMALE,
      maritalStatus: MaritalStatus.MARRIED,
      nationalId: 'CF90987654QRST',
      nssfNumber: 'NSSF67890123',
      tinNumber: '1000678901',
      phone: '+256700600006',
      email: 'mary.namutebi@hospital.ug',
      address: 'Kira, Wakiso',
      jobTitle: 'Midwife',
      department: 'Maternity',
      employmentType: EmploymentType.PERMANENT,
      hireDate: new Date('2019-04-15'),
      salaryGrade: 'N6',
      basicSalary: 1600000,
      allowances: [
        { name: 'Housing', amount: 280000, taxable: true },
        { name: 'Transport', amount: 180000, taxable: false },
      ],
      bankName: 'Stanbic Bank',
      bankAccountNumber: '9030087654321',
      annualLeaveBalance: 17,
      sickLeaveBalance: 11,
    },
    {
      employeeNumber: 'EMP00007',
      firstName: 'Robert',
      lastName: 'Ssempala',
      dateOfBirth: new Date('1995-02-14'),
      gender: Gender.MALE,
      maritalStatus: MaritalStatus.SINGLE,
      nationalId: 'CM95246813UVWX',
      nssfNumber: 'NSSF78901234',
      tinNumber: '1000789012',
      phone: '+256700700007',
      email: 'robert.ssempala@hospital.ug',
      address: 'Nansana, Wakiso',
      jobTitle: 'Clinical Officer',
      department: 'Medical',
      employmentType: EmploymentType.CONTRACT,
      hireDate: new Date('2023-01-10'),
      salaryGrade: 'C4',
      basicSalary: 1400000,
      allowances: [
        { name: 'Transport', amount: 200000, taxable: false },
      ],
      bankName: 'PostBank',
      bankAccountNumber: '4040034567890',
      annualLeaveBalance: 12,
      sickLeaveBalance: 8,
    },
    {
      employeeNumber: 'EMP00008',
      firstName: 'Agnes',
      lastName: 'Akello',
      dateOfBirth: new Date('1982-06-30'),
      gender: Gender.FEMALE,
      maritalStatus: MaritalStatus.WIDOWED,
      nationalId: 'CF82135792YZAB',
      nssfNumber: 'NSSF89012345',
      tinNumber: '1000890123',
      phone: '+256700800008',
      email: 'agnes.akello@hospital.ug',
      address: 'Mulago, Kampala',
      jobTitle: 'Theatre Nurse',
      department: 'Theatre',
      employmentType: EmploymentType.PERMANENT,
      hireDate: new Date('2012-09-01'),
      salaryGrade: 'N8',
      basicSalary: 2000000,
      allowances: [
        { name: 'Housing', amount: 350000, taxable: true },
        { name: 'Transport', amount: 220000, taxable: false },
        { name: 'Risk', amount: 150000, taxable: true },
      ],
      bankName: 'Absa Bank',
      bankAccountNumber: '6060056789012',
      annualLeaveBalance: 25,
      sickLeaveBalance: 14,
    },
    // Admin/Support Staff
    {
      employeeNumber: 'EMP00009',
      firstName: 'Charles',
      lastName: 'Muwanga',
      dateOfBirth: new Date('1978-08-20'),
      gender: Gender.MALE,
      maritalStatus: MaritalStatus.MARRIED,
      nationalId: 'CM78456123CDEF',
      nssfNumber: 'NSSF90123456',
      tinNumber: '1000901234',
      phone: '+256700900009',
      email: 'charles.muwanga@hospital.ug',
      address: 'Wandegeya, Kampala',
      jobTitle: 'Accountant',
      department: 'Finance',
      employmentType: EmploymentType.PERMANENT,
      hireDate: new Date('2014-05-20'),
      salaryGrade: 'A7',
      basicSalary: 2500000,
      allowances: [
        { name: 'Housing', amount: 450000, taxable: true },
        { name: 'Transport', amount: 280000, taxable: false },
      ],
      bankName: 'Standard Chartered',
      bankAccountNumber: '8080078901234',
      annualLeaveBalance: 22,
      sickLeaveBalance: 13,
    },
    {
      employeeNumber: 'EMP00010',
      firstName: 'Florence',
      lastName: 'Nassozi',
      dateOfBirth: new Date('1998-01-12'),
      gender: Gender.FEMALE,
      maritalStatus: MaritalStatus.SINGLE,
      nationalId: 'CF98789456GHIJ',
      nssfNumber: 'NSSF01234567',
      tinNumber: '1001012345',
      phone: '+256700100010',
      email: 'florence.nassozi@hospital.ug',
      address: 'Kisaasi, Kampala',
      jobTitle: 'Receptionist',
      department: 'Administration',
      employmentType: EmploymentType.PERMANENT,
      hireDate: new Date('2022-03-01'),
      salaryGrade: 'S3',
      basicSalary: 800000,
      allowances: [
        { name: 'Transport', amount: 120000, taxable: false },
      ],
      bankName: 'Centenary Bank',
      bankAccountNumber: '3120098765432',
      annualLeaveBalance: 14,
      sickLeaveBalance: 8,
    },
  ];

  let created = 0;
  for (const empData of employees) {
    const existing = await employeeRepo.findOne({ where: { employeeNumber: empData.employeeNumber } });
    if (!existing) {
      const employee = employeeRepo.create({
        ...empData,
        facilityId: facility.id,
        status: EmploymentStatus.ACTIVE,
      });
      await employeeRepo.save(employee);
      created++;
      console.log(`Created employee: ${empData.firstName} ${empData.lastName} (${empData.jobTitle})`);
    }
  }

  console.log(`\n✅ Seeded ${created} employees`);
  await dataSource.destroy();
}

seedEmployees().catch(console.error);
