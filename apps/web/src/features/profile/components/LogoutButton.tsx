'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@hamdastan/ui';

import { useAuthActions } from '@/features/auth';

import { accountErrorMessage } from '../hooks/use-account-actions';

/**
 * «خروج از حساب» — in settings and nowhere else, quiet until it is needed:
 * red text, no fill. It asks first, and the confirming action is the
 * destructive red, never the brand.
 */
export function LogoutButton() {
  const { logout } = useAuthActions();
  const [isLeaving, setIsLeaving] = useState(false);

  const confirm = async () => {
    setIsLeaving(true);
    try {
      await logout();
    } catch (error) {
      toast.error(accountErrorMessage(error));
      setIsLeaving(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="touch"
          className="w-full justify-start gap-3 px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut aria-hidden="true" className="size-5" />
          خروج از حساب
        </Button>
      </DialogTrigger>

      <DialogContent showCloseButton={false} className="w-[calc(100%-2.5rem)] rounded-2xl">
        <DialogHeader>
          <DialogTitle>از حساب خارج می‌شی؟</DialogTitle>
          <DialogDescription>هر وقت خواستی می‌تونی دوباره وارد بشی.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="touch" className="w-full">
              انصراف
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            size="touch"
            className="w-full"
            loading={isLeaving}
            onClick={() => void confirm()}
          >
            خروج
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
