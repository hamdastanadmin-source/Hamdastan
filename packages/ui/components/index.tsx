'use client';

/**
 * Central UI barrel.
 *
 * Apps import UI from `@hamdastan/ui` rather than reaching for a primitive
 * directly. A handful of components are re-exported through thin wrappers
 * that apply the app's RTL defaults, so callers never have to remember to
 * pass `dir`.
 */

import * as React from 'react';

import { APP_DIR } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';

import { Alert, AlertDescription, AlertTitle } from '../primitives/alert';
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '../primitives/avatar';
import { Badge, badgeVariants } from '../primitives/badge';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../primitives/breadcrumb';
import { Button, buttonVariants } from '../primitives/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../primitives/card';
import { Checkbox } from '../primitives/checkbox';
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
} from '../primitives/dialog';
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
} from '../primitives/dropdown-menu';
import { FormField } from '../primitives/form-field';
import { Input } from '../primitives/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '../primitives/input-otp';
import {
  Pagination,
  PaginationContent as PaginationContentPrimitive,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../primitives/pagination';
import {
  Popover,
  PopoverAnchor,
  PopoverContent as PopoverContentPrimitive,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../primitives/popover';
import { Progress } from '../primitives/progress';
import {
  RadioGroup as RadioGroupPrimitive,
  RadioGroupItem,
} from '../primitives/radio-group';
import { ScrollArea, ScrollBar } from '../primitives/scroll-area';
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
} from '../primitives/select';
import { Separator } from '../primitives/separator';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../primitives/sheet';
import { Skeleton } from '../primitives/skeleton';
import { Toaster } from '../primitives/sonner';
import { Slider } from '../primitives/slider';
import { Spinner } from '../primitives/spinner';
import { DotStepper, ProgressStepper, Stepper } from '../primitives/stepper';
import type { StepperProps } from '../primitives/stepper';
import { Switch } from '../primitives/switch';
import {
  Table as TablePrimitive,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../primitives/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../primitives/tabs';
import { Textarea } from '../primitives/textarea';
import { Toggle, toggleVariants } from '../primitives/toggle';
import { ToggleGroup, ToggleGroupItem } from '../primitives/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../primitives/tooltip';

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
export { RadioGroupItem };
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
export { Toaster };
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

/**
 * Radix writes `dir="ltr"` onto the radiogroup itself when nothing tells it
 * otherwise, which flips the row the items sit in and reverses what the arrow
 * keys do. It is not portalled — it is simply opinionated — so it needs the
 * same treatment as the portalled components above.
 */
export const RadioGroup = ({
  dir,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive> & { dir?: 'ltr' | 'rtl' }) => (
  <RadioGroupPrimitive dir={dir ?? APP_DIR} {...props} />
);

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

// ─── Chart library policy ────────────────────────────────────────────────────
// Add chart library imports here when one is chosen, so charts pick up the
// same RTL and font defaults as the rest of the UI.
