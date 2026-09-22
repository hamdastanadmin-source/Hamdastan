'use client';

/**
 * Central UI barrel.
 *
 * Every page and component imports UI from here (or from `@/components/ui/*`)
 * rather than reaching for a primitive directly. A handful of components are
 * re-exported through thin wrappers that apply the app's RTL defaults, so
 * callers never have to remember to pass `dir`.
 */

import * as React from 'react';

import { APP_DIR } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar';
import { Badge, badgeVariants } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu as DropdownMenuPrimitive,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import {
  Pagination,
  PaginationContent as PaginationContentPrimitive,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Popover,
  PopoverAnchor,
  PopoverContent as PopoverContentPrimitive,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select as SelectPrimitive,
  SelectContent as SelectContentPrimitive,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { DotStepper, ProgressStepper, Stepper } from '@/components/ui/stepper';
import type { StepperProps } from '@/components/ui/stepper';
import { Switch } from '@/components/ui/switch';
import {
  Table as TablePrimitive,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toggle, toggleVariants } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ─── Pass-through re-exports ─────────────────────────────────────────────────

export { Alert, AlertTitle, AlertDescription };
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
};
export { Badge, badgeVariants };
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
export { Button, buttonVariants };
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
export { Checkbox };
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
export {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
export { FormField };
export { Input };
export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
export {
  Pagination,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
export {
  Popover,
  PopoverTrigger,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
};
export { Progress };
export { RadioGroup, RadioGroupItem };
export { ScrollArea, ScrollBar };
export {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
export { Separator };
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
export { Skeleton };
export { Slider };
export { Spinner };
export { Stepper, DotStepper, ProgressStepper };
export type { StepperProps };
export { Switch };
export {
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
export { Tabs, TabsList, TabsTrigger, TabsContent };
export { Textarea };
export { Toggle, toggleVariants };
export { ToggleGroup, ToggleGroupItem };
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };

// ─── RTL wrappers ────────────────────────────────────────────────────────────
// Radix reads `dir` from a DirectionProvider or the nearest `dir` attribute.
// Portalled content (select, popover, dropdown) escapes the DOM subtree that
// carries `dir="rtl"`, so these wrappers set it explicitly.

export const Select = ({
  dir,
  ...props
}: React.ComponentProps<typeof SelectPrimitive> & { dir?: 'ltr' | 'rtl' }) => (
  <SelectPrimitive dir={dir ?? APP_DIR} {...props} />
);

export const SelectContent = ({
  dir,
  ...props
}: React.ComponentProps<typeof SelectContentPrimitive> & {
  dir?: 'ltr' | 'rtl';
}) => <SelectContentPrimitive dir={dir ?? APP_DIR} {...props} />;

export const PopoverContent = ({
  dir,
  ...props
}: React.ComponentProps<typeof PopoverContentPrimitive> & {
  dir?: 'ltr' | 'rtl';
}) => <PopoverContentPrimitive dir={dir ?? APP_DIR} {...props} />;

// Radix takes `dir` on the menu root, not on the portalled content.
export const DropdownMenu = ({
  dir,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive> & {
  dir?: 'ltr' | 'rtl';
}) => <DropdownMenuPrimitive dir={dir ?? APP_DIR} {...props} />;

/** Tables default to start-aligned text so Persian content reads correctly. */
export const Table = ({
  className,
  dir,
  ...props
}: React.ComponentProps<typeof TablePrimitive> & { dir?: 'ltr' | 'rtl' }) => (
  <TablePrimitive
    dir={dir ?? APP_DIR}
    className={cn('text-start', className)}
    {...props}
  />
);

/** Pagination sits at the start of the row, which is the right edge in RTL. */
export const PaginationContent = ({
  className,
  dir,
  ...props
}: React.ComponentProps<typeof PaginationContentPrimitive> & {
  dir?: 'ltr' | 'rtl';
}) => (
  <PaginationContentPrimitive
    dir={dir ?? APP_DIR}
    className={cn('justify-end', className)}
    {...props}
  />
);

// ─── Dynamic icon ────────────────────────────────────────────────────────────

export { DynamicIcon as Icon } from 'lucide-react/dynamic';
export type { IconName } from 'lucide-react/dynamic';

// ─── Chart library policy ────────────────────────────────────────────────────
// Add chart library imports here when one is chosen, so charts pick up the
// same RTL and font defaults as the rest of the UI.
