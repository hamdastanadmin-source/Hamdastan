import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';

/**
 * «راهنما و پشتیبانی» — how the account area works, in a few plain
 * answers. Static, and a server component: it ships no JavaScript.
 */

const TOPICS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: 'XP چیه و چطور می‌گیرمش؟',
    answer: 'XP امتیاز پیشرفتته. با انجام ماموریت‌ها — مثل آزمون شخصیت، ساخت آواتار و تکمیل پروفایل — XP می‌گیری. هر ماموریت فقط یک بار امتیاز داره.',
  },
  {
    question: 'سطح‌ها چطور کار می‌کنن؟',
    answer: 'با جمع شدن XP سطحت بالا می‌ره: سطح ۲ از ۱۰۰ XP، سطح ۳ از ۲۵۰ و سطح ۴ از ۵۰۰. توی پروفایلت همیشه می‌بینی چقدر تا سطح بعد مونده.',
  },
  {
    question: 'پروفایل اجتماعی از کجا میاد؟',
    answer: 'از جواب‌هات به آزمون کوتاه شخصیت. ازش استفاده می‌کنیم تا آدم‌ها، گروه‌ها و تجربه‌هایی که بیشتر بهت می‌خورن رو پیشنهاد بدیم. نتیجه‌ی کامل همیشه توی پروفایلت هست.',
  },
  {
    question: 'کی پروفایل اجتماعی من رو می‌بینه؟',
    answer: 'از «تنظیمات › حریم خصوصی» انتخاب می‌کنی که خلاصه‌ی نتیجه‌ات به بقیه نشون داده بشه یا نه. جزئیات و امتیازها هیچ‌وقت نمایش داده نمی‌شن.',
  },
];

export function HelpScreen() {
  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/profile/settings" />
      </ScreenHeader>

      <ScreenBody className="gap-8">
        <ScreenTitle title="راهنما و پشتیبانی" />

        <div className="flex flex-col gap-6">
          {TOPICS.map((topic) => (
            <section key={topic.question} className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">{topic.question}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{topic.answer}</p>
            </section>
          ))}
        </div>
      </ScreenBody>
    </Screen>
  );
}
