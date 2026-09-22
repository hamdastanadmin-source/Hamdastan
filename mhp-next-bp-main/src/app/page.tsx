import { Card, CardContent, CardHeader, CardTitle } from '@/components/UiComponents';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
    const user = await requireAuth();

    return (
        <div className="space-y-8 p-6">
            {/* Page Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight">داشبورد</h2>
                <p className="text-muted-foreground mt-1">
                    خوش آمدید، {user.fullName}
                </p>
            </div>

            {/* Placeholder Content */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">شروع کنید</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">
                        این داشبورد آماده سفارشی‌سازی است. ماژول‌های خود را اضافه کنید و محتوای این صفحه را به‌روزرسانی نمایید.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
