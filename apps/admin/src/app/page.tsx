import { Card, CardContent, CardHeader, CardTitle } from '@hamdastan/ui';

export default function AdminHomePage() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">پنل مدیریت</h1>
        <p className="text-muted-foreground mt-1">هم‌دستان</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">هنوز صفحه‌ای اضافه نشده است</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            این اپ فعلاً فقط پوستهٔ خالی پنل مدیریت است. صفحه‌های مدیریتی را
            زیر <code className="ltr inline-block">src/features</code> اضافه
            کنید و داده را از طریق <code className="ltr inline-block">src/services</code>{' '}
            از <code className="ltr inline-block">apps/api</code> بگیرید.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
