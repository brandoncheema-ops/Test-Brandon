import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding AAGM Portal database...");

  // ============================================================
  // CONTRACT VERSIONS
  // ============================================================

  // Prior contract version: Aug 2025 (Doctors Hospital only)
  const contractAug2025 = await prisma.contractVersion.upsert({
    where: { code: "DH-AUG2025" },
    update: {},
    create: {
      name: "Doctors Hospital - Aug 2025",
      code: "DH-AUG2025",
      effectiveStartDate: new Date("2025-05-01"),
      effectiveEndDate: new Date("2025-08-31"),
      invoiceAmount: 216000.0,
      requiredMonthlyRevenue: null,
      quarterTargetRevenue: null,
      annualFmvExpense: null,
      annualRequiredRevenue: null,
      maxAnnualSubsidy: null,
      includedLocations: JSON.stringify(["Doctors Hospital"]),
      invoiceTemplateConfig: JSON.stringify({
        companyName: "ANESTHESIA ASSOCIATES OF GREATER MIAMI, PA",
        address: "9655 South Dixie Hwy, Suite 201",
        city: "MIAMI, FLORIDA 33156",
        phone: "(305) 740-0823",
        fax: "(305) 740-0853",
      }),
      settlementRules: JSON.stringify({
        type: "fixed_monthly",
        notes:
          "Fixed monthly subsidy of $216,000. Doctors Hospital only. Separate contract scope from main hospitals.",
      }),
      periodMonths: 1,
      isActive: true,
      notes:
        "Historical contract for Doctors Hospital standalone. Invoice = $216,000/month. No quarter settlement logic for this version.",
    },
  });

  // Main contract version: Sept 2025 onward
  const contractSep2025 = await prisma.contractVersion.upsert({
    where: { code: "MAIN-SEP2025" },
    update: {},
    create: {
      name: "South Miami, West Kendall, Doral & Doctors - Sept 2025",
      code: "MAIN-SEP2025",
      effectiveStartDate: new Date("2025-09-01"),
      effectiveEndDate: new Date("2026-08-31"),
      invoiceAmount: 941666.67,
      requiredMonthlyRevenue: 1837500.0,
      quarterTargetRevenue: 5512500.0,
      annualFmvExpense: 33350000.0,
      annualRequiredRevenue: 22050000.0,
      maxAnnualSubsidy: 11300000.0,
      includedLocations: JSON.stringify([
        "SMH",
        "SMH-Cardiac",
        "WKH",
        "Doral",
        "Doctors Hospital",
        "BHHD",
      ]),
      invoiceTemplateConfig: JSON.stringify({
        companyName: "ANESTHESIA ASSOCIATES OF GREATER MIAMI, PA",
        address: "3350 SW 148TH AVE SUITE 110",
        city: "MIRAMAR, FLORIDA 33027",
        phone: "(305) 829-2252 Ex. 101",
        fax: "(305)816-6303",
        hospitalList:
          "South Miami Hospital, West Kendall Baptist Hospital, Doral & Doctors Hospital",
        subsidyNote:
          "Hospitals shall pay to Contractor each month the Monthly Subsidy payable hereunder in the amount of Nine Hundred Forty-One Thousand Six Hundred Sixty-Six Dollars and sixty-seven cents ($941,666.67) per month* plus any BHHD Physician Payments earned by Contractor.",
      }),
      settlementRules: JSON.stringify({
        type: "period_end_settlement",
        periodMonths: 3,
        contractStartMonth: 9,
        contractStartYear: 2025,
        description:
          "At end of each 3-month period, if total collections exceed period target, reduce last month subsidy by period overage. Non-end months receive full invoice amount.",
      }),
      periodMonths: 3,
      isActive: true,
      notes:
        "Primary contract effective Sept 1, 2025 - Aug 31, 2026. FMV = $33.35M/yr, Required Revenue = $22.05M/yr, Max Subsidy = $11.3M/yr. Quarter-end settlement applies.",
    },
  });

  // ============================================================
  // LOCATION ALIASES
  // ============================================================
  const aliases = [
    // SMH
    { source: "SMH", canonical: "SMH" },
    { source: "South Miami", canonical: "SMH" },
    { source: "South Miami Hospital", canonical: "SMH" },
    // SMH-Cardiac
    { source: "SMH-Cardiac", canonical: "SMH-Cardiac" },
    { source: "SMH Cardiac", canonical: "SMH-Cardiac" },
    { source: "SMH- Cardiac", canonical: "SMH-Cardiac" },
    // WKH
    { source: "WKH", canonical: "WKH" },
    { source: "WKBH", canonical: "WKH" },
    { source: "West Kendall", canonical: "WKH" },
    { source: "West Kendall Baptist", canonical: "WKH" },
    { source: "West Kendall Baptist Hospital", canonical: "WKH" },
    // Doral
    { source: "Doral", canonical: "Doral" },
    { source: "DH", canonical: "Doral" },
    // Doctors Hospital
    { source: "Doctors Hospital", canonical: "Doctors Hospital" },
    { source: "Doctor Hospital", canonical: "Doctors Hospital" },
    { source: "Doctors", canonical: "Doctors Hospital" },
    // BHHD
    { source: "BHHD", canonical: "BHHD" },
    { source: "Baptist Health Homestead", canonical: "BHHD" },
  ];

  for (const alias of aliases) {
    await prisma.locationAlias.upsert({
      where: {
        sourceValue_contractVersionId: {
          sourceValue: alias.source,
          contractVersionId: contractSep2025.id,
        },
      },
      update: {},
      create: {
        sourceValue: alias.source,
        canonicalValue: alias.canonical,
        contractVersionId: contractSep2025.id,
        isActive: true,
      },
    });
  }

  // DH-specific alias for old contract: DH -> Doctors Hospital
  await prisma.locationAlias.upsert({
    where: {
      sourceValue_contractVersionId: {
        sourceValue: "Doctors Hospital",
        contractVersionId: contractAug2025.id,
      },
    },
    update: {},
    create: {
      sourceValue: "Doctors Hospital",
      canonicalValue: "Doctors Hospital",
      contractVersionId: contractAug2025.id,
      isActive: true,
    },
  });

  // ============================================================
  // SAMPLE MONTH RUNS
  // ============================================================

  // Aug 2025 - Finalized (DH contract)
  const aug2025 = await prisma.monthRun.upsert({
    where: { periodKey: "2025-08" },
    update: {},
    create: {
      monthNumber: 8,
      yearNumber: 2025,
      monthLabel: "Aug 2025",
      periodKey: "2025-08",
      status: "finalized",
      contractVersionId: contractAug2025.id,
      carryforwardIn: 0,
      carryforwardOut: 0,
      notes: "Doctors Hospital standalone contract. Historical reference.",
      finalizedAt: new Date("2025-09-15"),
    },
  });

  // Create Aug 2025 financial summary
  await prisma.monthFinancialSummary.upsert({
    where: { monthRunId: aug2025.id },
    update: {},
    create: {
      monthRunId: aug2025.id,
      collectionsTotal: 395246.65,
      totalUnits: 6969,
      totalExpenses: 383180,
      requiredNetRevenue: 0,
      overage: 0,
      invoiceAmount: 216000.0,
      expectedPayment: 216000.0,
      actualPaymentReceived: 216000.0,
      periodCollectionsTotal: 395246.65,
      periodTargetRevenue: 0,
      periodOverage: 0,
      ytdSubsidyPaid: 216000.0,
      reconciliationDeltaInvoiceVsExpected: 0,
      reconciliationDeltaExpectedVsActual: 0,
      isDraft: false,
      calculationVersion: 1,
    },
  });

  // Sep 2025 - Finalized
  const sep2025 = await prisma.monthRun.upsert({
    where: { periodKey: "2025-09" },
    update: {},
    create: {
      monthNumber: 9,
      yearNumber: 2025,
      monthLabel: "Sep 2025",
      periodKey: "2025-09",
      status: "finalized",
      contractVersionId: contractSep2025.id,
      carryforwardIn: 0,
      carryforwardOut: 0,
      notes: "First month of new main contract.",
      finalizedAt: new Date("2025-10-20"),
    },
  });

  await prisma.monthFinancialSummary.upsert({
    where: { monthRunId: sep2025.id },
    update: {},
    create: {
      monthRunId: sep2025.id,
      collectionsTotal: 2041207.86,
      totalUnits: 55096,
      totalExpenses: 0,
      requiredNetRevenue: 1837500.0,
      overage: 203707.86,
      invoiceAmount: 941666.67,
      expectedPayment: 941666.67,
      actualPaymentReceived: 941666.67,
      periodCollectionsTotal: 2041207.86,
      periodTargetRevenue: 5512500.0,
      periodOverage: 0,
      ytdSubsidyPaid: 941666.67,
      reconciliationDeltaInvoiceVsExpected: 0,
      reconciliationDeltaExpectedVsActual: 0,
      isDraft: false,
      calculationVersion: 1,
    },
  });

  // Oct 2025 - Finalized
  const oct2025 = await prisma.monthRun.upsert({
    where: { periodKey: "2025-10" },
    update: {},
    create: {
      monthNumber: 10,
      yearNumber: 2025,
      monthLabel: "Oct 2025",
      periodKey: "2025-10",
      status: "finalized",
      contractVersionId: contractSep2025.id,
      carryforwardIn: 0,
      carryforwardOut: 0,
      finalizedAt: new Date("2025-11-18"),
    },
  });

  await prisma.monthFinancialSummary.upsert({
    where: { monthRunId: oct2025.id },
    update: {},
    create: {
      monthRunId: oct2025.id,
      collectionsTotal: 2119642.59,
      totalUnits: 44319,
      totalExpenses: 0,
      requiredNetRevenue: 1837500.0,
      overage: 282142.59,
      invoiceAmount: 941666.67,
      expectedPayment: 941666.67,
      actualPaymentReceived: 941666.67,
      periodCollectionsTotal: 4160850.45,
      periodTargetRevenue: 5512500.0,
      periodOverage: 0,
      ytdSubsidyPaid: 1883333.34,
      reconciliationDeltaInvoiceVsExpected: 0,
      reconciliationDeltaExpectedVsActual: 0,
      isDraft: false,
      calculationVersion: 1,
    },
  });

  // Nov 2025 - Finalized (period end with settlement)
  const nov2025 = await prisma.monthRun.upsert({
    where: { periodKey: "2025-11" },
    update: {},
    create: {
      monthNumber: 11,
      yearNumber: 2025,
      monthLabel: "Nov 2025",
      periodKey: "2025-11",
      status: "finalized",
      contractVersionId: contractSep2025.id,
      carryforwardIn: 0,
      carryforwardOut: 806643.57,
      notes:
        "Period end (Sep-Nov). Quarter settlement applied. Period overage = $806,643.57. Subsidy check reduced to $135,023.10.",
      finalizedAt: new Date("2025-12-15"),
    },
  });

  await prisma.monthFinancialSummary.upsert({
    where: { monthRunId: nov2025.id },
    update: {},
    create: {
      monthRunId: nov2025.id,
      collectionsTotal: 2158293.12,
      totalUnits: 42811,
      totalExpenses: 2434929.0,
      requiredNetRevenue: 1837500.0,
      overage: 320793.12,
      invoiceAmount: 941666.67,
      expectedPayment: 135023.1,
      actualPaymentReceived: null,
      periodCollectionsTotal: 6319143.57,
      periodTargetRevenue: 5512500.0,
      periodOverage: 806643.57,
      ytdSubsidyPaid: 2018356.44,
      reconciliationDeltaInvoiceVsExpected: 806643.57,
      reconciliationDeltaExpectedVsActual: null,
      isDraft: false,
      calculationVersion: 1,
    },
  });

  // Collections import rows for Nov 2025
  // (We don't have an upload file yet, but we'll create placeholder data)

  // Feb 2026 - Finalized
  const feb2026 = await prisma.monthRun.upsert({
    where: { periodKey: "2026-02" },
    update: {},
    create: {
      monthNumber: 2,
      yearNumber: 2026,
      monthLabel: "Feb 2026",
      periodKey: "2026-02",
      status: "finalized",
      contractVersionId: contractSep2025.id,
      carryforwardIn: 0,
      carryforwardOut: 0,
      finalizedAt: new Date("2026-03-10"),
    },
  });

  await prisma.monthFinancialSummary.upsert({
    where: { monthRunId: feb2026.id },
    update: {},
    create: {
      monthRunId: feb2026.id,
      collectionsTotal: 1758441.65,
      totalUnits: 52265,
      totalExpenses: 2802366.0,
      requiredNetRevenue: 1837500.0,
      overage: -79058.35,
      invoiceAmount: 941666.67,
      expectedPayment: 941666.67,
      actualPaymentReceived: null,
      periodCollectionsTotal: 1758441.65,
      periodTargetRevenue: 5512500.0,
      periodOverage: 0,
      ytdSubsidyPaid: 0,
      reconciliationDeltaInvoiceVsExpected: 0,
      reconciliationDeltaExpectedVsActual: null,
      isDraft: false,
      calculationVersion: 1,
    },
  });

  // Mar 2026 - Pending (future month)
  await prisma.monthRun.upsert({
    where: { periodKey: "2026-03" },
    update: {},
    create: {
      monthNumber: 3,
      yearNumber: 2026,
      monthLabel: "Mar 2026",
      periodKey: "2026-03",
      status: "pending",
      contractVersionId: contractSep2025.id,
      carryforwardIn: 0,
      carryforwardOut: 0,
      notes: "Pending future month. Awaiting file uploads.",
    },
  });

  // Apr 2026 - Pending
  await prisma.monthRun.upsert({
    where: { periodKey: "2026-04" },
    update: {},
    create: {
      monthNumber: 4,
      yearNumber: 2026,
      monthLabel: "Apr 2026",
      periodKey: "2026-04",
      status: "pending",
      contractVersionId: contractSep2025.id,
      carryforwardIn: 0,
      carryforwardOut: 0,
      notes: "Pending future month.",
    },
  });

  // Audit events for seeded data
  await prisma.auditEvent.createMany({
    data: [
      {
        monthRunId: aug2025.id,
        eventType: "finalize",
        eventDescription: "Month finalized (seeded historical data)",
      },
      {
        monthRunId: sep2025.id,
        eventType: "finalize",
        eventDescription: "Month finalized (seeded historical data)",
      },
      {
        monthRunId: oct2025.id,
        eventType: "finalize",
        eventDescription: "Month finalized (seeded historical data)",
      },
      {
        monthRunId: nov2025.id,
        eventType: "finalize",
        eventDescription:
          "Month finalized with quarter settlement. Period overage: $806,643.57",
      },
      {
        monthRunId: feb2026.id,
        eventType: "finalize",
        eventDescription: "Month finalized (seeded historical data)",
      },
    ],
  });

  console.log("Seed complete.");
  console.log("  Contract versions:", 2);
  console.log("  Location aliases:", aliases.length + 1);
  console.log("  Month runs:", 7);
  console.log("  Financial summaries:", 5);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
