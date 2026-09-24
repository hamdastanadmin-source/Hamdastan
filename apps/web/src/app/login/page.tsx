'use client';

import { useActionState } from 'react';
import { loginAction } from '@/features/auth';
import Image from 'next/image';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Input, Button } from '@hamdastan/ui';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <Image src="/images/brand/logo.svg" alt="Logo" width={140} height={48} className="h-10 w-auto" priority />
          <h1 className="text-lg font-semibold text-foreground">ورود به سامانه</h1>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              نام کاربری
            </label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              autoFocus
              placeholder="نام کاربری خود را وارد کنید"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              رمز عبور
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="pe-10"
                placeholder="رمز عبور خود را وارد کنید"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {state?.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <Button type="submit" loading={isPending} className="w-full h-11">
            <LogIn className="h-4 w-4" />
            {isPending ? 'در حال ورود...' : 'ورود'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground/50">هم‌دستان</p>
      </div>
    </div>
  );
}
