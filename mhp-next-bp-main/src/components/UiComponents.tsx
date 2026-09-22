'use client';

// Import local UI components
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Stepper, DotStepper, ProgressStepper } from '@/components/ui/stepper';
import type { StepperProps } from '@/components/ui/stepper';
import { APP_DIR } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import * as React from 'react';

import * as UI from '@parto-system-design/ui';

// Export local components (replacing the external ones)
export { Button, buttonVariants };
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
export { Badge, badgeVariants };
export { Input };
export { FormField };
export { Tabs, TabsList, TabsTrigger, TabsContent };
// Stepper is a fully custom component not present in @parto-system-design/ui
export { Stepper, DotStepper, ProgressStepper };
export type { StepperProps };
// ---------------------------------------------------------------------------
// Chart library policy
// ---------------------------------------------------------------------------
// Add chart library imports here when needed
// ---------------------------------------------------------------------------

// Re-export the rest from the external library for now
// We explicitly exclude the ones we replaced to avoid conflicts/confusion if we were to do `export *`
export const Textarea = UI.Textarea;
// Wrap Checkbox to fix tick visibility in dark mode.
// The library applies `text-foreground-contrast` to checked checkboxes, which
// resolves to near-black in dark mode via --color-foreground-contrast. Override
// the Tailwind color token at the element level so the tick is always readable.
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof UI.Checkbox>,
  React.ComponentPropsWithoutRef<typeof UI.Checkbox>
>(({ style, ...props }, ref) => (
  <UI.Checkbox
    ref={ref}
    style={{ '--color-foreground-contrast': 'hsl(0 0% 98%)', ...style } as React.CSSProperties}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";
export const RadioGroup = UI.RadioGroup;
export const RadioGroupItem = UI.RadioGroupItem;
export const Switch = UI.Switch;
export const Slider = UI.Slider;
export const Select = ({ dir, ...props }: React.ComponentPropsWithoutRef<typeof UI.Select> & { dir?: 'ltr' | 'rtl' }) => (
  <UI.Select dir={dir ?? APP_DIR} {...props} />
);
export const SelectContent = React.forwardRef<
  React.ElementRef<typeof UI.SelectContent>,
  React.ComponentPropsWithoutRef<typeof UI.SelectContent>
>(({ className, dir, ...props }, ref) => (
  <UI.SelectContent
    ref={ref}
    dir={dir ?? APP_DIR}
    className={className}
    {...props}
  />
));
SelectContent.displayName = "SelectContent";
export const SelectItem = UI.SelectItem;
export const SelectTrigger = UI.SelectTrigger;
export const SelectValue = UI.SelectValue;
// Badge is now exported from local src/components/ui/badge.tsx above
export const Avatar = UI.Avatar;
export const AvatarFallback = UI.AvatarFallback;
export const AvatarImage = UI.AvatarImage;
export const Skeleton = UI.Skeleton;
export const Spinner = UI.Spinner;
export const Progress = UI.Progress;
export const Alert = UI.Alert;
export const AlertTitle = UI.AlertTitle;
export const AlertDescription = UI.AlertDescription;
export const Table = React.forwardRef<
  React.ElementRef<typeof UI.Table>,
  React.ComponentPropsWithoutRef<typeof UI.Table>
>(({ className, dir, ...props }, ref) => (
  <UI.Table
    ref={ref}
    dir={dir ?? APP_DIR}
    className={cn("text-start", className)}
    {...props}
  />
));
Table.displayName = "Table";
export const TableHeader = UI.TableHeader;
export const TableBody = UI.TableBody;
export const TableFooter = UI.TableFooter;
export const TableHead = UI.TableHead;
export const TableRow = UI.TableRow;
export const TableCell = UI.TableCell;
export const TableCaption = UI.TableCaption;
export const Breadcrumb = UI.Breadcrumb;
export const BreadcrumbList = UI.BreadcrumbList;
export const BreadcrumbItem = UI.BreadcrumbItem;
export const BreadcrumbLink = UI.BreadcrumbLink;
export const BreadcrumbPage = UI.BreadcrumbPage;
export const BreadcrumbSeparator = UI.BreadcrumbSeparator;
export const Separator = UI.Separator;
export const ScrollArea = UI.ScrollArea;
export const Toggle = UI.Toggle;
export const ToggleGroup = UI.ToggleGroup;
export const ToggleGroupItem = UI.ToggleGroupItem;
export const InputOTP = UI.InputOTP;
export const InputOTPGroup = UI.InputOTPGroup;
export const InputOTPSlot = UI.InputOTPSlot;
export const Carousel = UI.Carousel;
export const CarouselContent = UI.CarouselContent;
export const CarouselItem = UI.CarouselItem;
export const CarouselPrevious = UI.CarouselPrevious;
export const CarouselNext = UI.CarouselNext;
export const Pagination = UI.Pagination;
export const PaginationContent = React.forwardRef<
  React.ElementRef<typeof UI.PaginationContent>,
  React.ComponentPropsWithoutRef<typeof UI.PaginationContent>
>(({ className, dir, ...props }, ref) => (
  <UI.PaginationContent
    ref={ref}
    dir={dir ?? APP_DIR}
    className={cn("justify-end", className)}
    {...props}
  />
));
PaginationContent.displayName = "PaginationContent";
export const PaginationEllipsis = UI.PaginationEllipsis;
export const PaginationItem = UI.PaginationItem;
export const PaginationLink = UI.PaginationLink;
export const PaginationNext = UI.PaginationNext;
export const PaginationPrevious = UI.PaginationPrevious;
export const Dialog = UI.Dialog;
export const DialogContent = UI.DialogContent;
export const DialogDescription = UI.DialogDescription;
export const DialogHeader = UI.DialogHeader;
export const DialogTitle = UI.DialogTitle;
export const DialogTrigger = UI.DialogTrigger;
export const DialogClose = UI.DialogClose;
export const Sheet = UI.Sheet;
export const SheetContent = UI.SheetContent;
export const SheetDescription = UI.SheetDescription;
export const SheetHeader = UI.SheetHeader;
export const SheetTitle = UI.SheetTitle;
export const SheetTrigger = UI.SheetTrigger;
export const SheetClose = UI.SheetClose;
export const SheetFooter = UI.SheetFooter;
export const Popover = UI.Popover;
export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof UI.PopoverContent>,
  React.ComponentPropsWithoutRef<typeof UI.PopoverContent>
>(({ className, dir, ...props }, ref) => (
  <UI.PopoverContent
    ref={ref}
    dir={dir ?? APP_DIR}
    className={className}
    {...props}
  />
));
PopoverContent.displayName = "PopoverContent";
export const PopoverTrigger = UI.PopoverTrigger;
export const Tooltip = UI.Tooltip;
export const TooltipContent = UI.TooltipContent;
export const TooltipProvider = UI.TooltipProvider;
export const TooltipTrigger = UI.TooltipTrigger;
export const DropdownMenu = UI.DropdownMenu;
export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof UI.DropdownMenuContent>,
  React.ComponentPropsWithoutRef<typeof UI.DropdownMenuContent>
>(({ className, ...props }, ref) => (
  <UI.DropdownMenuContent
    ref={ref}
    className={className}
    {...props}
  />
));
DropdownMenuContent.displayName = "DropdownMenuContent";
export const DropdownMenuItem = UI.DropdownMenuItem;
export const DropdownMenuLabel = UI.DropdownMenuLabel;
export const DropdownMenuSeparator = UI.DropdownMenuSeparator;
export const DropdownMenuTrigger = UI.DropdownMenuTrigger;
export const NavigationMenu = UI.NavigationMenu;
export const Command = UI.Command;
export const CommandDialog = UI.CommandDialog;
export const CommandEmpty = UI.CommandEmpty;
export const CommandGroup = UI.CommandGroup;
export const CommandInput = UI.CommandInput;
export const CommandItem = UI.CommandItem;
export const CommandList = UI.CommandList;
export const CommandSeparator = UI.CommandSeparator;
export const CommandShortcut = UI.CommandShortcut;
export const DatePicker = UI.DatePicker;
export const DateRangePicker = UI.DateRangePicker;
export const Calendar = UI.Calendar;
export const formatPersianDateRange = UI.formatPersianDateRange;
export const Toaster = UI.Toaster;
export const toast = UI.toast;

// Helper for dynamic icons
export const Icon = ({ name, className, ...props }: { name: string, className?: string, [key: string]: unknown }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icons = UI.Icons as any;
  const IconComp = Icons?.[name];
  if (!IconComp) {
    return null;
  }
  return <IconComp className={className} {...props} />;
};
