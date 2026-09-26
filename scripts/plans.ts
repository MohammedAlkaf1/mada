/**
 * The price list. Prices are in halalas and exclude VAT.
 *
 * A seat is an active membership of any role (BR-05). Storage counts every
 * accepted file, video included. -1 means uncapped.
 *
 * Read by scripts/plans-sync.ts (which brings a running database in line) and
 * by scripts/seed.ts (which seeds a fresh one), so the two can never disagree.
 * Nothing in src/ imports this file: the application reads plans from the
 * database, which is what the billing engine enforces.
 */
export const PLANS = [
  {
    code: 'free', nameAr: 'المجانية', nameEn: 'Free',
    descriptionAr: 'لتجربة المنصة بدورتين وفريق صغير قبل الالتزام',
    descriptionEn: 'Try the platform with two courses and a small team',
    priceMonthly: 0, maxCourses: 2, maxMembers: 20, storageMb: 1024,
    features: ['reports'], sortOrder: 0,
  },
  {
    code: 'basic', nameAr: 'الأساسية', nameEn: 'Basic',
    descriptionAr: 'لمعهد صغير أو إدارة تدريب تبدأ بتحويل دوراتها إلى المنصة',
    descriptionEn: 'For a small institute or a training team moving its first courses online',
    priceMonthly: 69000, maxCourses: 20, maxMembers: 150, storageMb: 20480,
    features: ['reports', 'exports', 'import', 'branding'], sortOrder: 1,
  },
  {
    code: 'growth', nameAr: 'النمو', nameEn: 'Growth',
    descriptionAr: 'للشركات والمعاهد التي تدرّب مئات المتدربين وتتابع التزامهم بالمواعيد',
    descriptionEn: 'For companies and institutes training hundreds of people against deadlines',
    priceMonthly: 189000, maxCourses: 100, maxMembers: 750, storageMb: 102400,
    features: ['reports', 'exports', 'import', 'branding'], sortOrder: 2,
  },
  {
    code: 'enterprise', nameAr: 'المؤسسية', nameEn: 'Enterprise',
    descriptionAr: 'للجهات الكبيرة والتعليمية: دورات بلا حد، مساحة واسعة، ومدير حساب مخصص',
    descriptionEn: 'For large and education bodies: unlimited courses, generous storage, a named account manager',
    priceMonthly: 490000, maxCourses: -1, maxMembers: 3000, storageMb: 512000,
    features: ['reports', 'exports', 'import', 'branding', 'support'], sortOrder: 3,
  },
] as const;
