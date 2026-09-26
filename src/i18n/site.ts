import type { Locale } from './dictionary';

/**
 * The words the public site is made of.
 *
 * Kept apart from the product dictionary because the two change for different
 * reasons: a label inside the application changes when a feature changes, while
 * this copy changes when the way we describe the product changes. Both locales
 * are full translations, not transliterations, and the Arabic is written first
 * because it is the language most of these organizations actually work in.
 *
 * Rules for this file: claim only what the product does today, no customer
 * names, no usage figures, and no dash used as a separator in visible text.
 */

const ar = {
  meta: {
    title: 'مدى · منصة التدريب والتعلّم للجهات',
    description:
      'منصة تعلّم إلكتروني للشركات ومعاهد التدريب والجهات التعليمية. ترفع الجهة دوراتها، وتسندها لأعضائها بموعد تسليم، وتتابع من أكمل ومن تأخر، وتصدر شهادات إتمام يمكن التحقق منها.',
  },
  nav: {
    product: 'المزايا',
    how: 'كيف تعمل',
    certificates: 'الشهادات',
    security: 'الأمان',
    pricing: 'الأسعار',
    contact: 'تواصل معنا',
    login: 'تسجيل الدخول',
    start: 'ابدأ التجربة المجانية',
    menu: 'القائمة',
  },
  hero: {
    eyebrow: 'منصة تدريب وتعلّم للجهات',
    title: 'دوراتكم أنتم، على منصة باسم جهتكم',
    body: 'ترفع الجهة محتواها التدريبي، وتسنده لموظفيها أو متدربيها بموعد تسليم، وتعرف من أكمل ومن تأخر. ومن يجتاز الدورة يحصل على شهادة إتمام يمكن لأي أحد التحقق منها.',
    primary: 'ابدأ تجربة مجانية 14 يومًا',
    secondary: 'اطلب عرضًا توضيحيًا',
    note: 'لا نطلب بطاقة عند التسجيل. المنصة لا تأتي بمحتوى جاهز، فالدورات من إعداد جهتك.',
    illustration: {
      label: 'مثال توضيحي لثلاث شاشات من المنصة: دورة مسندة لمتدرب، وسؤال من الاختبار النهائي، وشهادة إتمام.',
      course: {
        tag: 'دورة مسندة',
        title: 'السلامة المهنية في المستودعات',
        due: 'موعد التسليم 12 أكتوبر',
        progress: 'التقدم',
        progressValue: '3 من 5 دروس',
        lessons: [
          { title: 'مقدمة الدورة', kind: 'نص' },
          { title: 'دليل الإجراءات', kind: 'PDF' },
          { title: 'التعامل مع معدات الرفع', kind: 'فيديو' },
          { title: 'خطة الإخلاء', kind: 'رابط' },
          { title: 'الاختبار النهائي', kind: 'اختبار' },
        ],
      },
      quiz: {
        tag: 'الاختبار النهائي',
        counter: 'السؤال 3 من 10',
        timer: 'متبقٍ 18:40',
        question: 'ما أول إجراء عند ملاحظة تسرب في منطقة التخزين؟',
        options: ['إكمال العمل ثم الإبلاغ', 'إخلاء المنطقة وإبلاغ المشرف', 'تنظيف التسرب مباشرة'],
        saved: 'حُفظت الإجابة',
      },
      certificate: {
        tag: 'شهادة إتمام',
        org: 'شعار جهتك',
        title: 'شهادة إتمام دورة',
        name: 'سارة القحطاني',
        course: 'السلامة المهنية في المستودعات',
        number: 'رقم الشهادة',
        numberValue: '7K4Q 29MC',
        verify: 'امسح الرمز للتحقق',
      },
    },
  },
  trust: [
    { title: 'مساحة مستقلة لكل جهة', body: 'بيانات جهتك معزولة عن غيرها، ولا يراها إلا أعضاؤها بحسب أدوارهم.' },
    { title: 'تحقق بخطوتين للمديرين', body: 'إلزامي لكل حساب بصلاحية مدير، لأن المدير يصل إلى بيانات الجميع.' },
    { title: 'شهادات يمكن التحقق منها', body: 'لكل شهادة رقم فريد ورمز QR يفتح صفحة تحقق عامة.' },
    { title: 'العربية أولًا', body: 'واجهة عربية كاملة من اليمين إلى اليسار، والإنجليزية متاحة لمن يحتاجها.' },
  ],
  journey: {
    eyebrow: 'كيف تعمل',
    title: 'من رفع الدورة إلى إصدار الشهادة',
    body: 'هذا ما يمر به كل مقرر على المنصة، من إعداده حتى آخر شهادة تصدر منه.',
    steps: [
      { title: 'أنشئ الدورة', body: 'قسّمها إلى وحدات ودروس من نص أو ملف PDF أو فيديو أو رابط خارجي، وأضف اختبارًا نهائيًا ثم انشرها.' },
      { title: 'أضف الأشخاص', body: 'أضفهم واحدًا واحدًا أو استوردهم من ملف CSV أو Excel، ووزّعهم على مجموعات.' },
      { title: 'أسند بموعد تسليم', body: 'اختر مجموعة أو أفرادًا، وحدد تاريخ البدء وموعد التسليم إن أردت. التذكير يصل تلقائيًا.' },
      { title: 'تابع التقدم', body: 'ترى من بدأ ومن أكمل ومن تأخر، لكل دورة ولكل مجموعة، وتصدّر التقرير متى احتجت.' },
      { title: 'تصدر الشهادات', body: 'حين يكمل المتدرب الدروس المطلوبة ويجتاز الاختبار تصدر شهادته بشعار جهتك دون تدخل.' },
    ],
  },
  features: {
    eyebrow: 'المزايا',
    title: 'لكل دور في جهتك ما يحتاجه',
    body: 'في المنصة ثلاثة أدوار: مدير الجهة والمدرب والمتدرب، ويرى كل منهم ما يخصه.',
    groups: [
      {
        role: 'مدير الجهة',
        summary: 'يجهّز المساحة، ويدير الأشخاص والإسناد والتقارير والاشتراك.',
        items: [
          { title: 'هوية جهتك', body: 'اسم الجهة وشعارها ولونها داخل المنصة وعلى الشهادات.' },
          { title: 'الأشخاص والمجموعات', body: 'استيراد من CSV أو XLSX مع معاينة قبل الحفظ، وسبب واضح لكل صف مرفوض.' },
          { title: 'الإسناد والتذكير', body: 'تذكير قبل موعد التسليم بثمانٍ وأربعين ساعة، وإشعار واحد عند التأخر، بالبريد وداخل المنصة.' },
          { title: 'التقارير', body: 'المسجلون ومن بدأ ومن أكمل والمتأخرون والمنسحبون، مع تصفية بالدورة والنسخة والمجموعة والتاريخ، وتقرير لكل متدرب.' },
          { title: 'التصدير', body: 'ملف CSV يفتحه Excel بالعربية دون تشوه في الحروف، وحزمة كاملة لبيانات الجهة بصيغة ZIP.' },
        ],
      },
      {
        role: 'المدرب',
        summary: 'يبني الدورات والاختبارات بنفسه، دون حاجة إلى فريق تقني.',
        items: [
          { title: 'أربعة أنواع من الدروس', body: 'نص، أو ملف PDF، أو فيديو MP4 حتى 1 جيجابايت، أو رابط خارجي يبدأ بـ https.' },
          { title: 'مطلوب واختياري', body: 'تحدد الدروس اللازمة لإكمال الدورة، وتضيف ما يفيد المتدرب دون أن يؤخر شهادته.' },
          { title: 'نسخ الدورة', body: 'حين يُسجَّل متدربون في نسخة تُقفل، والتعديل الجوهري ينشئ نسخة جديدة، فلا تتغير نتائج من سبق.' },
          { title: 'الاختبار النهائي', body: 'أسئلة بإجابة واحدة وأسئلة صح أو خطأ، بدرجة لكل سؤال ودرجة نجاح وعدد محاولات ومدة اختيارية.' },
          { title: 'تصحيح على الخادم', body: 'الإجابات الصحيحة لا تصل إلى متصفح المتدرب أثناء المحاولة، والتصحيح يجري على الخادم.' },
        ],
      },
      {
        role: 'المتدرب',
        summary: 'يعرف المطلوب منه وموعده، ويكمل دوراته على مهله قبل الموعد.',
        items: [
          { title: 'دوراتي', body: 'كل دورة مسندة إليه مع تاريخ البدء وموعد التسليم ومقدار ما أنجزه.' },
          { title: 'إكمال الفيديو', body: 'يُحتسب درس الفيديو بعد مشاهدة 90% من مدته الفعلية، والتقديم السريع لا يُحتسب.' },
          { title: 'تأكيد الإنهاء', body: 'دروس النص والملف والرابط تكتمل حين يؤكد المتدرب أنه أنهاها.' },
          { title: 'اختبار محفوظ', body: 'الإجابات تُحفظ تلقائيًا، والمدة يحسبها خادم المنصة لا جهاز المتدرب.' },
          { title: 'شهادته بصيغة PDF', body: 'يحمّل شهادة الإتمام فور استيفاء شروط الدورة.' },
        ],
      },
    ],
  },
  certificates: {
    eyebrow: 'الشهادات',
    title: 'شهادة إتمام يستطيع أي أحد التحقق منها',
    body: 'تصدر الشهادة تلقائيًا حين يستوفي المتدرب شروط الدورة، بصيغة PDF تحمل شعار جهتك ورقمًا فريدًا ورمز QR. من يمسح الرمز يصل إلى صفحة تحقق عامة.',
    points: [
      { title: 'أقل قدر من البيانات', body: 'صفحة التحقق تعرض اسم حامل الشهادة بصيغة مختصرة والدورة والجهة وتاريخ الإصدار وحالة الشهادة، ولا تعرض بريدًا ولا درجات.' },
      { title: 'رقم لا يتكرر', body: 'لكل شهادة رقم خاص بها مرتبط بسجلها في المنصة، فلا يكفي تعديل ملف لإثبات شهادة لم تصدر.' },
      { title: 'إلغاء بسبب مكتوب', body: 'إن صدرت شهادة بالخطأ يلغيها مدير الجهة ويذكر السبب، وتظهر صفحة التحقق أنها ملغاة.' },
    ],
    note: 'هي شهادة إتمام تثبت أن المتدرب أنهى الدورة واجتاز اختبارها لدى جهتك، وليست اعتمادًا مهنيًا أو أكاديميًا.',
  },
  security: {
    eyebrow: 'الأمان والخصوصية',
    title: 'بيانات متدربيك تبقى لجهتك',
    body: 'جهتك هي صاحبة القرار في بيانات أعضائها، ونحن نعالجها نيابة عنها لتشغيل الخدمة فقط. هذه الضوابط تعمل في كل الباقات.',
    items: [
      { title: 'عزل بين الجهات', body: 'كل استعلام وملف وتقرير محصور في مساحة جهته، ولا يعبر إلى جهة أخرى.' },
      { title: 'تحقق بخطوتين', body: 'إلزامي لكل حساب بصلاحية مدير قبل الوصول إلى بيانات الجهة.' },
      { title: 'ملفات خاصة ومفحوصة', body: 'الملفات المرفوعة لا تُتاح برابط عام، وتُفحص قبل أن تصل إلى المتدربين.' },
      { title: 'سجل نشاط', body: 'سجل للقراءة فقط يوضح من غيّر ماذا ومتى، ولا يمكن تعديله من داخل المنصة.' },
      { title: 'نسخ احتياطي يومي', body: 'نسخة احتياطية كل يوم، وتنتهي صلاحية النسخ القديمة بعد مدة محددة.' },
      { title: 'بياناتك معك إن غادرت', body: 'حزمة كاملة لبيانات الجهة يحمّلها المدير متى شاء، وتبقى متاحة ثلاثين يومًا بعد انتهاء الاشتراك.' },
    ],
  },
  audience: {
    title: 'لمن صُممت مدى',
    body: 'لأي جهة لديها محتوى تدريبي، وتحتاج أن تعرف من أكمله وفي أي موعد.',
    items: [
      { title: 'الشركات', body: 'تهيئة الموظفين الجدد، والسياسات الداخلية، والسلامة، وكل تدريب إلزامي يحتاج موعد تسليم وسجلًا واضحًا.' },
      { title: 'معاهد ومراكز التدريب', body: 'دورات تقدمها لمتدربيك بشهادة إتمام تحمل اسم المعهد وشعاره.' },
      { title: 'الجهات التعليمية', body: 'مواد مساندة للطلاب، وتدريب للمعلمين والإداريين، بتقارير على مستوى المجموعة والفرد.' },
    ],
  },
  pricing: {
    eyebrow: 'الأسعار',
    title: 'باقات بحسب المقاعد والدورات والتخزين',
    body: 'أربع باقات شهرية بالريال السعودي، أولها مجانية. تبدأ كل جهة بتجربة مدتها أربعة عشر يومًا قبل أن تدفع.',
    perMonth: 'شهريًا',
    free: 'مجانًا',
    cta: 'ابدأ بهذه الباقة',
    contactCta: 'تحدث إلينا',
    limits: { courses: 'الدورات', seats: 'المقاعد', storage: 'التخزين' },
    storageUnit: 'جيجابايت',
    unlimited: 'بلا حد',
    featured: 'مناسبة لأغلب الجهات',
    includes: 'يشمل',
    featureLabels: {
      reports: 'تقارير التقدم والإكمال',
      exports: 'تصدير التقارير بصيغة CSV',
      import: 'استيراد الأشخاص من CSV أو XLSX',
      branding: 'شعار الجهة ولونها',
      support: 'مدير حساب مخصص',
    },
    payment: 'الدفع بمدى أو فيزا أو ماستركارد أو Apple Pay عبر بوابة ميسّر، أو بالتحويل البنكي. تصدر فاتورة ضريبية لكل دفعة.',
    vat: 'الأسعار شهرية بالريال السعودي ولا تشمل ضريبة القيمة المضافة.',
    explainTitle: 'كيف تُحسب الباقة',
    explain: [
      { title: 'المقعد', body: 'كل عضو نشط في جهتك يشغل مقعدًا، مديرًا كان أو مدربًا أو متدربًا. إيقاف العضو يحرر مقعده.' },
      { title: 'التخزين', body: 'مجموع حجم الملفات المرفوعة، ومنها الفيديو وملفات PDF وصور الأغلفة.' },
      { title: 'الدورات', body: 'عدد الدورات القائمة في مساحتك. الدورة المؤرشفة لا تدخل في العدد.' },
      { title: 'التجربة المجانية', body: 'أربعة عشر يومًا من يوم التسجيل دون بطاقة. بعدها تختار الباقة وتدفع أول فاتورة لتستمر.' },
    ],
    featuresTitle: 'في كل الباقات',
    features: [
      'واجهة عربية وإنجليزية',
      'بناء الدورات والاختبار النهائي',
      'شهادات إتمام برمز تحقق',
      'تذكيرات بالبريد وداخل المنصة',
      'تحقق بخطوتين وسجل نشاط',
      'حزمة كاملة لبيانات الجهة',
    ],
    faqTitle: 'أسئلة عن الاشتراك',
    faq: [
      { q: 'هل أحتاج بطاقة للتجربة؟', a: 'لا. تسجّل جهتك وتبدأ مباشرة، ولا نطلب وسيلة دفع خلال الأيام الأربعة عشر.' },
      { q: 'ماذا يحدث إذا بلغنا حد المقاعد؟', a: 'لا يمكن إضافة عضو نشط جديد حتى يُحرَّر مقعد بإيقاف عضو لم يعد يحتاج المنصة، أو تُرقّى الباقة.' },
      { q: 'هل أستطيع تغيير الباقة لاحقًا؟', a: 'نعم. الترقية تسري فورًا، والتخفيض يسري عند التجديد، ولا يُقبل التخفيض إذا كان استخدامك الحالي أكبر من حدود الباقة الأصغر.' },
      { q: 'كيف أدفع؟', a: 'بمدى أو فيزا أو ماستركارد أو Apple Pay عبر بوابة الدفع ميسّر، ويُفعَّل الاشتراك بعد نجاح الدفع. أو بالتحويل البنكي، ويُفعَّل بعد تأكيد وصول المبلغ.' },
      { q: 'هل تصدر فاتورة ضريبية؟', a: 'نعم، تصدر فاتورة ضريبية باسم جهتك لكل دفعة، والأسعار المعروضة لا تشمل ضريبة القيمة المضافة.' },
    ],
  },
  faq: {
    title: 'أسئلة شائعة',
    items: [
      { q: 'هل تأتي المنصة بدورات جاهزة؟', a: 'لا. مدى منصة تشغّل عليها جهتك دوراتها الخاصة. أنتم تعدّون المحتوى وترفعونه، والمنصة توفر أدوات تقديمه ومتابعته.' },
      { q: 'ما المقصود بالمقعد؟', a: 'كل عضو نشط في جهتك بأي دور، مدير أو مدرب أو متدرب. عدد المقاعد في كل باقة موضح في صفحة الأسعار.' },
      { q: 'ما حدود رفع الفيديو؟', a: 'ملف بصيغة MP4 حتى 1 جيجابايت لكل درس، ويُخصم حجمه من مساحة التخزين في باقتك. يكتمل الدرس بعد مشاهدة 90% من مدته الفعلية.' },
      { q: 'هل الشهادة معتمدة؟', a: 'هي شهادة إتمام تصدرها جهتك وتثبت أن المتدرب أنهى الدورة واجتاز اختبارها. ليست اعتمادًا مهنيًا أو أكاديميًا، ولا تمنح مدى اعتمادًا من أي نوع.' },
      { q: 'ما طرق الدفع؟', a: 'مدى وفيزا وماستركارد وApple Pay عبر بوابة ميسّر، أو التحويل البنكي. الأسعار لا تشمل ضريبة القيمة المضافة، وتصدر فاتورة ضريبية لكل دفعة.' },
      { q: 'ماذا يحدث لبياناتنا إذا غادرنا؟', a: 'يستطيع مدير الجهة تحميل حزمة كاملة لبياناتها في أي وقت. بعد انتهاء الاشتراك تبقى متاحة للتصدير ثلاثين يومًا، ثم تُحذف البيانات التشغيلية خلال ثلاثين يومًا أخرى، وتنتهي النسخ الاحتياطية خلال ثلاثين يومًا بعد ذلك.' },
      { q: 'هل تعمل المنصة بالإنجليزية؟', a: 'نعم. العربية هي الأساس، ويستطيع كل مستخدم التبديل إلى الإنجليزية من أعلى الصفحة.' },
    ],
  },
  cta: {
    title: 'جرّب مدى على دورة من دوراتكم',
    body: 'أنشئ مساحة جهتك، وارفع دورة واحدة، وأسندها لمجموعة صغيرة. خلال أسبوعين تعرف إن كانت المنصة تناسبكم.',
    primary: 'ابدأ تجربة مجانية',
    secondary: 'اطلب عرضًا توضيحيًا',
  },
  contact: {
    title: 'تواصل معنا',
    body: 'أخبرنا عن جهتك، وعدد المتدربين تقريبًا، ونوع المحتوى الذي لديكم، ونرد عليك خلال يوم عمل.',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    organization: 'اسم الجهة',
    phone: 'رقم الجوال',
    phoneHint: 'اختياري، بصيغة دولية تبدأ بعلامة زائد',
    topic: 'موضوع الرسالة',
    topics: { demo: 'طلب عرض توضيحي', pricing: 'سؤال عن الأسعار', security: 'الأمان والخصوصية', support: 'دعم فني', other: 'موضوع آخر' },
    message: 'رسالتك',
    consent: 'أوافق على استخدام بياناتي للرد على هذه الرسالة فقط',
    submit: 'أرسل الرسالة',
    success: 'وصلتنا رسالتك. سنرد عليك خلال يوم عمل.',
    failure: 'تعذر إرسال الرسالة. حاول مرة أخرى بعد قليل.',
    aside: {
      title: 'قبل أن تكتب',
      points: [
        'إن أردت أن ترى المنصة بنفسك فابدأ التجربة المجانية مباشرة، ولا حاجة إلى انتظارنا.',
        'إن كان سؤالك عن حماية البيانات فاذكر طبيعة جهتك ونوع البيانات لديكم حتى تكون الإجابة دقيقة.',
        'لا ترسل بيانات متدربين حقيقية عبر هذا النموذج.',
      ],
    },
  },
  legal: {
    updated: 'آخر تحديث',
    tocTitle: 'محتويات الصفحة',
    terms: {
      title: 'شروط الاستخدام',
      intro:
        'تنظم هذه الشروط استخدام منصة مدى للتدريب والتعلّم. إنشاء مساحة لجهة على المنصة أو استخدامها يعني الموافقة على هذه الشروط، ومن يوافق نيابة عن جهة يقر بأنه مخول بذلك.',
      sections: [
        {
          title: 'الخدمة',
          body: 'مدى منصة تعلّم إلكتروني تتيح للجهة رفع دوراتها وبناء اختباراتها وإسنادها لأعضائها ومتابعة إكمالها وإصدار شهادات الإتمام. لا تتضمن الخدمة أي محتوى تدريبي من إعدادنا. تُقدم الخدمة عبر الإنترنت، وقد نضيف مزايا أو نعدلها مع إشعار مسبق بالتغييرات الجوهرية.',
        },
        {
          title: 'الحساب ومساحة الجهة',
          body: 'المساحة تعود للجهة لا للأفراد. يحدد مدير الجهة الأعضاء وأدوارهم، مديرًا أو مدربًا أو متدربًا، وهو مسؤول عن صحة هذا التحديد. التحقق بخطوتين إلزامي لحسابات المديرين، وعلى كل مستخدم حماية بيانات دخوله وإبلاغنا فور الاشتباه في دخول غير مصرح به.',
        },
        {
          title: 'المحتوى الذي ترفعه الجهة',
          body: 'الجهة مسؤولة عن المحتوى الذي ترفعه، وتقر بأنها تملك حق استخدامه وإتاحته لأعضائها. تبقى ملكية المحتوى للجهة، ولا نستخدمه لغير تشغيل الخدمة. لنا أن نوقف إتاحة أي ملف يرفضه فحص الملفات أو يخالف الأنظمة.',
        },
        {
          title: 'شهادات الإتمام',
          body: 'الشهادات التي تصدر من المنصة شهادات إتمام تصدرها الجهة لأعضائها، وتثبت إكمال الدورة واجتياز اختبارها وفق الشروط التي وضعتها الجهة. ليست اعتمادًا مهنيًا أو أكاديميًا من مدى، والجهة مسؤولة عن أي وصف تضيفه إلى دوراتها وعن إلغاء ما صدر بالخطأ.',
        },
        {
          title: 'الاستخدام المقبول',
          body: 'يلتزم المستخدم بالأنظمة السعودية النافذة، وبعدم إدخال بيانات لا يملك أساسًا نظاميًا لمعالجتها، وبعدم استخدام المنصة لإيذاء الغير أو الوصول إلى بيانات جهة أخرى أو تعطيل الخدمة أو رفع محتوى مخالف.',
        },
        {
          title: 'بيانات الجهة',
          body: 'تبقى البيانات التي تدخلها الجهة، ومنها بيانات أعضائها وتقدمهم ونتائجهم، ملكًا لها، والجهة هي جهة التحكم فيها. نعالجها نيابة عنها ووفق تعليماتها لتشغيل الخدمة فقط، ولا نبيعها، ولا نطلع عليها إلا حين يلزم ذلك لتشغيل الخدمة أو بطلب من الجهة.',
        },
        {
          title: 'الباقات والحدود',
          body: 'لكل باقة حد لعدد الدورات والمقاعد ومساحة التخزين. المقعد هو كل عضو نشط في الجهة بأي دور. عند بلوغ الحد لا تُقبل إضافة جديدة حتى تُرقّى الباقة أو يقل الاستخدام.',
        },
        {
          title: 'الاشتراك والدفع',
          body: 'تبدأ الجهة بتجربة مجانية مدتها أربعة عشر يومًا. بعدها يُدفع الاشتراك شهريًا وفق الباقة المختارة، إلكترونيًا عبر بوابة الدفع أو بالتحويل البنكي، وتصدر فاتورة ضريبية لكل دفعة. الأسعار لا تشمل ضريبة القيمة المضافة. عند التأخر في السداد تُمنح الجهة فترة سماح، ثم تُعلَّق المساحة دون حذف بياناتها، ويُستأنف العمل فور السداد.',
        },
        {
          title: 'التوافر والنسخ الاحتياطي',
          body: 'نبذل عناية مهنية معقولة لإبقاء الخدمة متاحة، ونجري الصيانة في أوقات معلنة قدر الإمكان، ونأخذ نسخة احتياطية يومية من البيانات. لا نلتزم بنسبة توافر محددة ما لم ترد في عقد موقَّع يحدد طريقة القياس والتعويض.',
        },
        {
          title: 'الملكية الفكرية',
          body: 'المنصة وشفرتها وتصميمها وعلاماتها مملوكة لنا. لا يمنح الاشتراك أي حق في نسخها أو اشتقاق أعمال منها أو إعادة بيعها، ويمنح حق استخدامها للغرض المتفق عليه طوال مدة الاشتراك.',
        },
        {
          title: 'الإنهاء وما بعده',
          body: 'للجهة إنهاء اشتراكها متى شاءت، ولنا إنهاؤه عند مخالفة جوهرية للشروط بعد إشعار ومهلة للمعالجة. بعد انتهاء الاشتراك يستطيع مدير الجهة تصدير بياناتها كاملة خلال ثلاثين يومًا. بعدها تُحذف البيانات التشغيلية خلال ثلاثين يومًا، وتنتهي صلاحية النسخ الاحتياطية التي تحتويها خلال ثلاثين يومًا بعد ذلك.',
        },
        {
          title: 'حدود المسؤولية',
          body: 'تُقدم الخدمة بالحالة التي هي عليها مع بذل عناية مهنية معقولة. لا نتحمل الأضرار غير المباشرة أو الفائت من الربح. وفي كل الأحوال لا تتجاوز مسؤوليتنا الإجمالية ما سددته الجهة خلال الاثني عشر شهرًا السابقة للواقعة، ما لم ينص نظام آمر على خلاف ذلك.',
        },
        {
          title: 'النظام الواجب التطبيق',
          body: 'تخضع هذه الشروط للأنظمة المعمول بها في المملكة العربية السعودية، وتختص الجهات القضائية السعودية بالنظر في أي نزاع ينشأ عنها.',
        },
        {
          title: 'تعديل الشروط',
          body: 'قد نعدل هذه الشروط. نُشعر الجهات بالتغييرات الجوهرية قبل سريانها بمدة معقولة عبر البريد المسجل ومن داخل المنصة، ويعني الاستمرار في الاستخدام بعد السريان قبولًا بالنسخة المحدثة.',
        },
      ],
    },
    privacy: {
      title: 'سياسة الخصوصية',
      intro:
        'توضح هذه السياسة كيف نتعامل مع البيانات الشخصية في منصة مدى. نفرق بين حالتين: بيانات المتدربين والمدربين التي تدخلها الجهة المشتركة، والجهة فيها هي جهة التحكم ونحن جهة معالجة نيابة عنها، وبيانات ممثلي الجهات وزوار الموقع، ونحن فيها جهة التحكم.',
      sections: [
        {
          title: 'دورنا في كل حالة',
          body: 'الجهة التي تشغّل دوراتها على المنصة هي التي تقرر من تضيف من أعضاء ولأي غرض، ونحن نعالج بياناتهم وفق تعليماتها ولتشغيل الخدمة فقط. أما بياناتك بصفتك ممثلًا لجهة تعاقدت معنا أو زائرًا راسلنا، فنحن جهة التحكم فيها ونعالجها لإدارة العلاقة والرد عليك.',
        },
        {
          title: 'ما تعالجه المنصة عن الأعضاء',
          body: 'الاسم والبريد والدور والمجموعة، والدورات المسندة ومواعيدها، والتقدم في الدروس، ومحاولات الاختبار ودرجاتها، والشهادات الصادرة. تطلع الجهة على هذه البيانات وتصدّرها، ولا نستخدمها لغير تشغيل الخدمة.',
        },
        {
          title: 'صفحة التحقق من الشهادات',
          body: 'حين يمسح أحد رمز الشهادة تعرض صفحة التحقق العامة اسم حاملها بصيغة مختصرة، واسم الدورة والجهة، وتاريخ الإصدار، وحالة الشهادة. لا تعرض البريد ولا الدرجات ولا أي معرّف آخر.',
        },
        {
          title: 'ما نجمعه عنك',
          body: 'بيانات الحساب مثل الاسم والبريد واسم الجهة والدور. بيانات الاستخدام التقنية اللازمة للتشغيل والأمان مثل وقت الدخول ومعرّف الطلب. وما ترسله إلينا طوعًا في نموذج التواصل. لا نستخدم أدوات تتبع إعلانية ولا نبني ملفات اهتمامات.',
        },
        {
          title: 'ملفات الارتباط',
          body: 'نستخدم ملفات ارتباط ضرورية فقط: ملف الجلسة لإبقائك مسجل الدخول، وملف يحفظ اللغة، وملف يحفظ الوضع الفاتح أو الداكن. لا توجد ملفات ارتباط إعلانية أو تحليلية من طرف ثالث.',
        },
        {
          title: 'أساس المعالجة',
          body: 'نعالج بيانات الحساب لتنفيذ العقد مع الجهة، وبيانات الأمان والسجلات لمصلحة مشروعة في حماية الخدمة والوفاء بالالتزامات النظامية، وما ترسله في نموذج التواصل بناء على موافقتك التي تستطيع سحبها في أي وقت.',
        },
        {
          title: 'مشاركة البيانات',
          body: 'لا نبيع البيانات الشخصية. نشاركها فقط مع مزودي خدمة يلزمون للتشغيل، مثل الاستضافة وإرسال البريد وبوابة الدفع، بعقود تقصر استخدامهم على ما نطلبه، ومع الجهات المختصة حين يوجب النظام ذلك. بيانات البطاقة تُدخل في صفحة بوابة الدفع ولا تُحفظ لدينا. وأي نقل للبيانات خارج المملكة يخضع لتقييم مسبق وضوابط تعاقدية.',
        },
        {
          title: 'مدة الاحتفاظ',
          body: 'تبقى بيانات الجهة طوال مدة اشتراكها. بعد انتهاء الاشتراك تستطيع الجهة تصدير بياناتها خلال ثلاثين يومًا، ثم تُحذف البيانات التشغيلية خلال ثلاثين يومًا أخرى، وتنتهي صلاحية النسخ الاحتياطية خلال ثلاثين يومًا بعد ذلك. بيانات التعاقد والفواتير نحتفظ بها للمدة التي توجبها الأنظمة، ورسائل التواصل تُحذف بعد انتهاء الغرض منها.',
        },
        {
          title: 'حقوقك',
          body: 'لك الحق في العلم والاطلاع والحصول على نسخة وطلب التصحيح أو الإتلاف وسحب الموافقة. إن كنت متدربًا أو مدربًا لدى جهة تستخدم المنصة فوجّه طلبك إليها بوصفها جهة التحكم، ونساعدها في تنفيذه. وإن كانت بياناتك لدينا مباشرة فراسلنا.',
        },
        {
          title: 'الأمان',
          body: 'تشفير الاتصال، وتجزئة كلمات المرور، وتحقق بخطوتين إلزامي للمديرين، وعزل بين الجهات، وتخزين خاص للملفات مع فحصها، وسجل نشاط، ونسخ احتياطي يومي. لا يعني ذلك انعدام المخاطر، ولذلك لدينا إجراء موثق للتعامل مع الحوادث.',
        },
        {
          title: 'الحوادث',
          body: 'نسجل وقت العلم بالحادثة ونطاقها وتقييمها والإجراء المتخذ، ونبلغ الجهة المشتركة دون تأخير غير مبرر حتى تتمكن من إشعار الجهة المختصة وأصحاب البيانات حين تتحقق شروط ذلك نظامًا.',
        },
        {
          title: 'التواصل بشأن الخصوصية',
          body: 'لأي سؤال أو طلب يتعلق بهذه السياسة استخدم صفحة التواصل واختر موضوع الأمان والخصوصية، ونرد خلال المهلة النظامية.',
        },
      ],
    },
  },
  footer: {
    tagline: 'منصة تدريب وتعلّم للجهات. المحتوى من إعدادكم، والأدوات منا.',
    product: 'المنتج',
    company: 'مدى',
    legal: 'الوثائق',
    rights: 'جميع الحقوق محفوظة.',
    madeIn: 'العربية أولًا، والإنجليزية متاحة.',
  },
} as const;

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Widen<T[K]> }
      : T;

export type SiteCopy = Widen<typeof ar>;

const en: SiteCopy = {
  meta: {
    title: 'Mada · Training and learning platform for organizations',
    description:
      'A learning platform for companies, training institutes and education bodies. Upload your own courses, assign them with a due date, see who finished and who is late, and issue completion certificates anyone can verify.',
  },
  nav: {
    product: 'Features',
    how: 'How it works',
    certificates: 'Certificates',
    security: 'Security',
    pricing: 'Pricing',
    contact: 'Contact',
    login: 'Sign in',
    start: 'Start free trial',
    menu: 'Menu',
  },
  hero: {
    eyebrow: 'Training and learning platform for organizations',
    title: 'Your courses, on a platform with your name on it',
    body: 'Upload your own training content, assign it to staff or trainees with a due date, and see who has finished and who is behind. Everyone who passes gets a completion certificate that anyone can verify.',
    primary: 'Start a 14 day free trial',
    secondary: 'Request a demo',
    note: 'No card needed to sign up. Mada ships no ready made content: the courses are yours.',
    illustration: {
      label: 'Illustration of three screens: a course assigned to a learner, a question from the final quiz, and a completion certificate.',
      course: {
        tag: 'Assigned course',
        title: 'Warehouse safety',
        due: 'Due 12 October',
        progress: 'Progress',
        progressValue: '3 of 5 lessons',
        lessons: [
          { title: 'Introduction', kind: 'Text' },
          { title: 'Procedures handbook', kind: 'PDF' },
          { title: 'Working with lifting equipment', kind: 'Video' },
          { title: 'Evacuation plan', kind: 'Link' },
          { title: 'Final quiz', kind: 'Quiz' },
        ],
      },
      quiz: {
        tag: 'Final quiz',
        counter: 'Question 3 of 10',
        timer: '18:40 left',
        question: 'What is the first thing to do when you notice a leak in the storage area?',
        options: ['Finish the task, then report it', 'Clear the area and tell the supervisor', 'Clean up the leak straight away'],
        saved: 'Answer saved',
      },
      certificate: {
        tag: 'Completion certificate',
        org: 'Your logo',
        title: 'Certificate of completion',
        name: 'Sara Alqahtani',
        course: 'Warehouse safety',
        number: 'Certificate no.',
        numberValue: '7K4Q 29MC',
        verify: 'Scan to verify',
      },
    },
  },
  trust: [
    { title: 'A separate space per organization', body: 'Your data is isolated from every other organization and seen only by your members, according to their role.' },
    { title: 'Two step verification for admins', body: 'Required on every admin account, because an admin can reach everyone’s data.' },
    { title: 'Certificates you can verify', body: 'Each certificate has a unique number and a QR code that opens a public verification page.' },
    { title: 'Arabic first', body: 'A complete right to left Arabic interface, with English for those who need it.' },
  ],
  journey: {
    eyebrow: 'How it works',
    title: 'From uploading a course to issuing the certificate',
    body: 'What every course goes through on Mada, from the day it is built to the last certificate it issues.',
    steps: [
      { title: 'Build the course', body: 'Split it into modules and lessons made of text, PDF, video or an external link, add a final quiz, and publish.' },
      { title: 'Add people', body: 'Add them one at a time or import them from a CSV or Excel file, and sort them into groups.' },
      { title: 'Assign with a due date', body: 'Pick a group or individuals, set a start date and, if you want, a due date. Reminders go out on their own.' },
      { title: 'Follow progress', body: 'See who started, who finished and who is late, per course and per group, and export the report when you need it.' },
      { title: 'Certificates are issued', body: 'Once a learner completes the required lessons and passes the quiz, a certificate with your logo is issued automatically.' },
    ],
  },
  features: {
    eyebrow: 'Features',
    title: 'What each role in your organization gets',
    body: 'There are three roles: organization admin, instructor and learner. Each sees what concerns them.',
    groups: [
      {
        role: 'Organization admin',
        summary: 'Sets up the space and runs people, assignments, reports and the subscription.',
        items: [
          { title: 'Your identity', body: 'Your organization’s name, logo and colour across the platform and on certificates.' },
          { title: 'People and groups', body: 'Import from CSV or XLSX with a preview before saving and a clear reason for every rejected row.' },
          { title: 'Assignments and reminders', body: 'A reminder 48 hours before the due date and one overdue notice, by email and in the platform.' },
          { title: 'Reports', body: 'Enrolled, started, completed, overdue and withdrawn, filtered by course, version, group and date, plus a report per learner.' },
          { title: 'Export', body: 'CSV files that open in Excel with Arabic intact, and a full data package for the organization as a ZIP file.' },
        ],
      },
      {
        role: 'Instructor',
        summary: 'Builds courses and quizzes without needing a technical team.',
        items: [
          { title: 'Four kinds of lesson', body: 'Text, a PDF file, an MP4 video up to 1 GB, or an external link starting with https.' },
          { title: 'Required and optional', body: 'Decide which lessons count towards completion, and add extra material that never holds up a certificate.' },
          { title: 'Course versions', body: 'A version locks once learners are enrolled in it. A substantive change creates a new version, so earlier results never change.' },
          { title: 'Final quiz', body: 'Single choice and true or false questions, with points per question, a pass mark, an attempts limit and an optional time limit.' },
          { title: 'Graded on the server', body: 'Correct answers never reach the learner’s browser during an attempt, and grading happens on the server.' },
        ],
      },
      {
        role: 'Learner',
        summary: 'Knows what is expected and by when, and works through it at their own pace.',
        items: [
          { title: 'My courses', body: 'Every assigned course with its start date, due date and how much is done.' },
          { title: 'Video completion', body: 'A video lesson counts after 90% of its actual length has been watched. Skipping ahead does not count.' },
          { title: 'Confirm when done', body: 'Text, PDF and link lessons complete when the learner confirms they have finished them.' },
          { title: 'A quiz that keeps your answers', body: 'Answers are saved as you go, and the time limit runs on the server clock, not the learner’s device.' },
          { title: 'A PDF certificate', body: 'Download the completion certificate as soon as the course requirements are met.' },
        ],
      },
    ],
  },
  certificates: {
    eyebrow: 'Certificates',
    title: 'A completion certificate anyone can verify',
    body: 'The certificate is issued automatically when a learner meets the course requirements: a PDF with your logo, a unique number and a QR code. Scanning the code opens a public verification page.',
    points: [
      { title: 'As little data as possible', body: 'The verification page shows a short form of the holder’s name, the course, the organization, the issue date and the status. No email, no scores.' },
      { title: 'A number that never repeats', body: 'Each certificate has its own number tied to its record on the platform, so an edited file cannot prove a certificate that was never issued.' },
      { title: 'Revoked with a written reason', body: 'If a certificate was issued by mistake, the admin revokes it with a reason and the verification page shows it as revoked.' },
    ],
    note: 'It is a certificate of completion: it shows the learner finished the course and passed its quiz with your organization. It is not a professional or academic accreditation.',
  },
  security: {
    eyebrow: 'Security and privacy',
    title: 'Your learners’ data stays with your organization',
    body: 'Your organization decides what happens to its members’ data, and we process it on your behalf only to run the service. These controls apply on every plan.',
    items: [
      { title: 'Isolation between organizations', body: 'Every query, file and report is confined to its own organization’s space and never crosses into another.' },
      { title: 'Two step verification', body: 'Required on every admin account before it can reach the organization’s data.' },
      { title: 'Private, scanned files', body: 'Uploaded files are never available at a public address, and are scanned before learners can open them.' },
      { title: 'Activity log', body: 'A read only log of who changed what and when, which cannot be edited from inside the platform.' },
      { title: 'Daily backups', body: 'A backup every day, with older backups expiring after a fixed period.' },
      { title: 'Your data leaves with you', body: 'A full data package the admin can download at any time, still available for 30 days after the subscription ends.' },
    ],
  },
  audience: {
    title: 'Who Mada is for',
    body: 'Any organization with its own training content that needs to know who completed it, and when.',
    items: [
      { title: 'Companies', body: 'Onboarding, internal policies, safety, and any mandatory training that needs a due date and a clear record.' },
      { title: 'Training institutes and centres', body: 'Courses you deliver to your trainees, with a completion certificate carrying your institute’s name and logo.' },
      { title: 'Education bodies', body: 'Supporting material for students and training for teachers and staff, with reports by group and by person.' },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Plans by seats, courses and storage',
    body: 'Four monthly plans in Saudi riyals, the first one free. Every organization starts with a 14 day trial before paying anything.',
    perMonth: 'per month',
    free: 'Free',
    cta: 'Start with this plan',
    contactCta: 'Talk to us',
    limits: { courses: 'Courses', seats: 'Seats', storage: 'Storage' },
    storageUnit: 'GB',
    unlimited: 'Unlimited',
    featured: 'Fits most organizations',
    includes: 'Includes',
    featureLabels: {
      reports: 'Progress and completion reports',
      exports: 'CSV export of reports',
      import: 'Import people from CSV or XLSX',
      branding: 'Your logo and colour',
      support: 'Named account manager',
    },
    payment: 'Pay by mada, Visa, Mastercard or Apple Pay through Moyasar, or by bank transfer. A VAT invoice is issued for every payment.',
    vat: 'Prices are monthly, in Saudi riyals, and exclude VAT.',
    explainTitle: 'How a plan is counted',
    explain: [
      { title: 'Seat', body: 'Every active member takes a seat, whether admin, instructor or learner. Deactivating a member frees their seat.' },
      { title: 'Storage', body: 'The total size of uploaded files, including video, PDF files and cover images.' },
      { title: 'Courses', body: 'The number of live courses in your space. Archived courses do not count.' },
      { title: 'Free trial', body: 'Fourteen days from sign up, with no card. After that you pick a plan and pay the first invoice to carry on.' },
    ],
    featuresTitle: 'On every plan',
    features: [
      'Arabic and English interface',
      'Course builder and final quiz',
      'Completion certificates with a verification code',
      'Reminders by email and in the platform',
      'Two step verification and activity log',
      'Full organization data package',
    ],
    faqTitle: 'Subscription questions',
    faq: [
      { q: 'Do I need a card for the trial?', a: 'No. Register your organization and start straight away. We do not ask for a payment method during the fourteen days.' },
      { q: 'What happens when we reach the seat limit?', a: 'No new active member can be added until a seat is freed by deactivating someone who no longer needs access, or the plan is upgraded.' },
      { q: 'Can I change plan later?', a: 'Yes. An upgrade applies at once, a downgrade applies at renewal, and a downgrade is refused if your current usage is above the smaller plan’s limits.' },
      { q: 'How do I pay?', a: 'By mada, Visa, Mastercard or Apple Pay through the Moyasar gateway, and the subscription is activated once payment succeeds. Or by bank transfer, activated once the funds are confirmed.' },
      { q: 'Do you issue VAT invoices?', a: 'Yes, a VAT invoice in your organization’s name for every payment. The prices shown exclude VAT.' },
    ],
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      { q: 'Does Mada come with ready made courses?', a: 'No. Mada is a platform your organization runs its own courses on. You prepare and upload the content; the platform gives you the tools to deliver and track it.' },
      { q: 'What counts as a seat?', a: 'Every active member of your organization in any role: admin, instructor or learner. The seats in each plan are listed on the pricing page.' },
      { q: 'What are the video limits?', a: 'An MP4 file up to 1 GB per lesson, counted against your plan’s storage. The lesson completes after 90% of its actual length has been watched.' },
      { q: 'Is the certificate an accreditation?', a: 'It is a certificate of completion issued by your organization, showing the learner finished the course and passed its quiz. It is not a professional or academic accreditation, and Mada grants no accreditation of any kind.' },
      { q: 'How can we pay?', a: 'mada, Visa, Mastercard and Apple Pay through Moyasar, or bank transfer. Prices exclude VAT, and a VAT invoice is issued for every payment.' },
      { q: 'What happens to our data if we leave?', a: 'The admin can download a full data package at any time. After the subscription ends it stays available for export for 30 days, operational data is then deleted within a further 30 days, and backups expire within 30 days after that.' },
      { q: 'Does Mada work in English?', a: 'Yes. Arabic comes first, and every user can switch to English from the top of the page.' },
    ],
  },
  cta: {
    title: 'Try Mada on one of your own courses',
    body: 'Create your organization’s space, upload one course and assign it to a small group. Within two weeks you will know whether it fits.',
    primary: 'Start free trial',
    secondary: 'Request a demo',
  },
  contact: {
    title: 'Contact us',
    body: 'Tell us about your organization, roughly how many learners you have and what kind of content, and we will reply within one working day.',
    name: 'Name',
    email: 'Email',
    organization: 'Organization',
    phone: 'Mobile number',
    phoneHint: 'Optional, in international format starting with a plus sign',
    topic: 'Topic',
    topics: { demo: 'Request a demo', pricing: 'Pricing question', security: 'Security and privacy', support: 'Technical support', other: 'Something else' },
    message: 'Your message',
    consent: 'I agree to my details being used only to reply to this message',
    submit: 'Send message',
    success: 'Your message has arrived. We will reply within one working day.',
    failure: 'The message could not be sent. Please try again shortly.',
    aside: {
      title: 'Before you write',
      points: [
        'If you want to see the platform for yourself, start the free trial now. There is no need to wait for us.',
        'If your question is about data protection, tell us what kind of organization you are and what data you hold, so the answer is accurate.',
        'Please do not send real learner data through this form.',
      ],
    },
  },
  legal: {
    updated: 'Last updated',
    tocTitle: 'On this page',
    terms: {
      title: 'Terms of use',
      intro:
        'These terms govern the use of Mada, a training and learning platform. Creating an organization space on the platform or using it means accepting these terms, and anyone accepting on behalf of an organization confirms they are authorised to do so.',
      sections: [
        { title: 'The service', body: 'Mada is a learning platform that lets an organization upload its courses, build quizzes, assign courses to its members, follow completion and issue completion certificates. The service includes no training content prepared by us. It is delivered online, and features may be added or changed with advance notice of material changes.' },
        { title: 'Accounts and the organization space', body: 'The space belongs to the organization, not to individuals. The organization admin decides who the members are and their roles, admin, instructor or learner, and is responsible for getting this right. Two step verification is required on admin accounts. Every user must protect their sign in details and tell us at once if they suspect unauthorised access.' },
        { title: 'Content the organization uploads', body: 'The organization is responsible for the content it uploads and confirms it has the right to use it and make it available to its members. Ownership of the content stays with the organization, and we use it only to operate the service. We may withhold any file that fails the file scan or breaks the law.' },
        { title: 'Completion certificates', body: 'Certificates issued from the platform are certificates of completion issued by the organization to its members, confirming completion of the course and a pass in its quiz under the conditions the organization set. They are not a professional or academic accreditation from Mada. The organization is responsible for how it describes its courses and for revoking anything issued in error.' },
        { title: 'Acceptable use', body: 'Users must comply with the laws in force in Saudi Arabia, must not enter data they have no lawful basis to process, and must not use the platform to harm others, reach another organization’s data, disrupt the service or upload unlawful content.' },
        { title: 'Organization data', body: 'Data entered by an organization, including its members’ details, progress and results, remains its property, and the organization is its controller. We process it on the organization’s behalf, under its instructions, solely to operate the service. We do not sell it, and we access it only where operating the service requires or the organization asks.' },
        { title: 'Plans and limits', body: 'Each plan has a limit on courses, seats and storage. A seat is any active member of the organization in any role. When a limit is reached, nothing new can be added until the plan is upgraded or usage goes down.' },
        { title: 'Subscription and payment', body: 'An organization starts with a free fourteen day trial. After that the subscription is paid monthly according to the chosen plan, online through the payment gateway or by bank transfer, and a VAT invoice is issued for every payment. Prices exclude VAT. If payment is late the organization is given a grace period, after which the space is suspended with its data left intact, and work resumes as soon as payment is recorded.' },
        { title: 'Availability and backups', body: 'We take reasonable professional care to keep the service available, schedule maintenance in announced windows where possible, and take a daily backup of the data. We commit to no specific availability figure unless one appears in a signed contract defining measurement and remedy.' },
        { title: 'Intellectual property', body: 'The platform, its code, design and marks belong to us. A subscription grants no right to copy it, derive works from it, or resell it, and grants the right to use it for the agreed purpose throughout the subscription.' },
        { title: 'Termination and after', body: 'An organization may end its subscription at any time, and we may end it for a material breach after notice and a period to remedy. After the subscription ends the organization admin can export all of its data for 30 days. Operational data is then deleted within a further 30 days, and backups containing it expire within 30 days after that.' },
        { title: 'Limitation of liability', body: 'The service is provided as it stands, with reasonable professional care. We are not liable for indirect damages or lost profit. In every case our total liability does not exceed what the organization paid in the twelve months before the event, unless mandatory law provides otherwise.' },
        { title: 'Governing law', body: 'These terms are governed by the laws in force in the Kingdom of Saudi Arabia, and Saudi courts have jurisdiction over any dispute arising from them.' },
        { title: 'Changes to these terms', body: 'We may amend these terms. Organizations are notified of material changes a reasonable time before they take effect, by email and inside the platform, and continued use after they take effect means acceptance of the updated version.' },
      ],
    },
    privacy: {
      title: 'Privacy policy',
      intro:
        'This policy explains how personal data is handled on Mada. Two cases are distinguished: learner and instructor data entered by a subscribing organization, where that organization is the controller and we process the data on its behalf, and data about organization representatives and site visitors, where we are the controller.',
      sections: [
        { title: 'Our role in each case', body: 'An organization running its courses on the platform decides which members it adds and for what purpose, and we process their data under its instructions solely to operate the service. Your own data, as a representative of an organization that contracts with us or a visitor who writes to us, is data we control and process to manage the relationship and reply to you.' },
        { title: 'What the platform processes about members', body: 'Name, email, role and group; assigned courses and their dates; lesson progress; quiz attempts and scores; and certificates issued. The organization can see and export this data, and we use it for nothing but operating the service.' },
        { title: 'The certificate verification page', body: 'When someone scans a certificate’s code, the public verification page shows a short form of the holder’s name, the course and organization names, the issue date and the certificate’s status. It never shows an email, a score or any other identifier.' },
        { title: 'What we collect about you', body: 'Account data such as name, email, organization and role. Technical usage data needed for operation and security, such as sign in time and request identifier. And whatever you choose to send us through the contact form. We use no advertising trackers and build no interest profiles.' },
        { title: 'Cookies', body: 'We use strictly necessary cookies only: a session cookie to keep you signed in, one that stores the language, and one that stores light or dark appearance. There are no advertising or third party analytics cookies.' },
        { title: 'Basis for processing', body: 'Account data is processed to perform our contract with the organization. Security data and logs rest on a legitimate interest in protecting the service and meeting regulatory obligations. What you send through the contact form rests on your consent, which you may withdraw at any time.' },
        { title: 'Sharing', body: 'We do not sell personal data. We share it only with service providers needed to operate, such as hosting, email delivery and the payment gateway, under contracts limiting their use to what we instruct, and with competent authorities where the law requires. Card details are entered on the payment gateway’s page and are not stored by us. Any transfer outside the Kingdom is subject to prior assessment and contractual safeguards.' },
        { title: 'Retention', body: 'An organization’s data is kept for as long as it subscribes. After the subscription ends the organization can export its data for 30 days, operational data is then deleted within a further 30 days, and backups expire within 30 days after that. Contracting and invoice data is kept for the period the regulations require, and contact messages are deleted once their purpose ends.' },
        { title: 'Your rights', body: 'You have the right to be informed, to access, to obtain a copy, to request correction or erasure, and to withdraw consent. If you are a learner or instructor at an organization using the platform, send your request to that organization as the controller and we will help it respond. If we hold your data directly, write to us.' },
        { title: 'Security', body: 'Encryption in transit, hashed passwords, mandatory two step verification for admins, isolation between organizations, private file storage with scanning, an activity log and daily backups. None of this means risk is absent, which is why we keep a documented incident procedure.' },
        { title: 'Incidents', body: 'We record when we learned of an incident, its scope, its assessment and the action taken, and inform the subscribing organization without undue delay so it can notify the competent authority and data subjects where the conditions for that are met.' },
        { title: 'Privacy contact', body: 'For any question or request about this policy use the contact page and choose the security and privacy topic. We reply within the statutory period.' },
      ],
    },
  },
  footer: {
    tagline: 'A training and learning platform for organizations. The content is yours; the tools are ours.',
    product: 'Product',
    company: 'Mada',
    legal: 'Documents',
    rights: 'All rights reserved.',
    madeIn: 'Arabic first, with English available.',
  },
};

const copy: Record<Locale, SiteCopy> = { ar, en };
export function getSiteCopy(locale: Locale): SiteCopy {
  return copy[locale];
}

/** The date shown on the legal pages. Bump it when the wording changes. */
export const LEGAL_UPDATED = '2026-09-26';
