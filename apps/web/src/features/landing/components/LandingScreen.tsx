'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Film, Heart, Mail, Sparkles } from 'lucide-react';

import { Avatar, Button, Card, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';
import { cn } from '@hamdastan/shared/cn';

import { Screen, ScreenBody, ScreenFooter } from '@/components';

/**
 * What the product is, for someone who has never heard of it.
 *
 * The `dark landing` classes remap the tokens for this subtree only: the rest
 * of the product stays light. The one primary action is the sticky footer's,
 * so it can be taken from any point in the story. The two choices made here only dress the
 * invitation at the bottom of the page; nothing is saved. Scroll motion is CSS
 * (`.landing-*` in `globals.css`), so this file holds no scroll listener.
 */

const IMAGE_SIZES = '(max-width: 430px) 100vw, 430px';
const CASTLE = '/images/brand/landing-castle.webp';
const FRIENDS = '/images/brand/landing-friends.webp';
const OWL = '/images/brand/landing-owl.webp';

const CHAPTERS = [
  { href: '#world', number: '۰۱', label: 'جهان محبوبت' },
  { href: '#people', number: '۰۲', label: 'آدم‌های خودت' },
  { href: '#memories', number: '۰۳', label: 'خاطره‌های ما' },
] as const;

const HOUSES = [
  { id: 'gryffindor', name: 'گریفیندور', mark: 'G', color: 'bg-landing-gryffindor', welcome: 'گریفیندوری! شجاعتت رو بیار؛ قصه‌مون تازه شروع شده.' },
  { id: 'slytherin', name: 'اسلیترین', mark: 'S', color: 'bg-landing-slytherin', welcome: 'اسلیترینی! یه هم‌داستانِ بلندپرواز کم داشتیم.' },
  { id: 'ravenclaw', name: 'ریونکلا', mark: 'R', color: 'bg-landing-ravenclaw', welcome: 'ریونکلایی! برای بحث‌های بی‌آخر، آماده‌ایم.' },
  { id: 'hufflepuff', name: 'هافلپاف', mark: 'H', color: 'bg-landing-hufflepuff', welcome: 'هافلپافی! جای یه رفیقِ درست‌وحسابی خالی بود.' },
] as const;

/** Each face is a crop of the group illustration, not a profile of a real member. */
const FACES = [
  { left: 50, top: 15, rotate: -8, mark: 'G', color: 'bg-landing-gryffindor', crop: '4.6% 16.5%' },
  { left: 80.3, top: 32.3, rotate: 8, mark: 'S', color: 'bg-landing-slytherin', crop: '23.5% 28.5%' },
  { left: 80.3, top: 67.7, rotate: -6, mark: 'H', color: 'bg-landing-hufflepuff', crop: '40.2% 10%' },
  { left: 50, top: 85, rotate: 6, mark: 'R', color: 'bg-landing-ravenclaw', crop: '60% 24.5%' },
  { left: 19.7, top: 67.7, rotate: 8, mark: 'G', color: 'bg-landing-gryffindor', crop: '85% 23%' },
  { left: 19.7, top: 32.3, rotate: -8, mark: 'S', color: 'bg-landing-slytherin', crop: '100% 30%' },
] as const;

const MEMORIES = {
  film: { label: 'فیلم‌پارتی', title: 'بارِ صدم، با آدم‌های تازه.' },
  debate: { label: 'کل‌کل پاتری', title: 'بحثی که تموم نمی‌شه!' },
  meetup: { label: 'دورهمی پاترهدی', title: 'از «تو هم؟» تا «یادته؟»' },
} as const;
type MemoryId = keyof typeof MEMORIES;

const SHIELD = 'grid place-items-center pb-0.5 font-serif font-bold text-foreground [clip-path:polygon(0_0,100%_0,100%_66%,50%_100%,0_66%)]';

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="landing-reveal flex items-center gap-2.5 text-xs">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-landing-accent" />
      {children}
    </p>
  );
}

function Chapter({
  id,
  number,
  step,
  title,
  description,
  children,
  next,
}: {
  id: string;
  number: string;
  step: string;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  next: { href: string; label: string };
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="relative isolate flex scroll-mt-16 flex-col gap-8 overflow-clip px-4 pt-[4.5rem] pb-8">
      <span aria-hidden="true" className="absolute start-4 top-8 -z-10 text-[180px] leading-none font-bold text-foreground/[.03]">
        {number}
      </span>
      <div className="flex flex-col px-2">
        <Eyebrow>{step}</Eyebrow>
        <h2 id={`${id}-title`} className="landing-reveal mt-4 text-[2rem] leading-[1.6] font-bold tracking-tight">
          {title}
        </h2>
        <p className="landing-reveal mt-4 text-sm leading-loose text-muted-foreground">{description}</p>
      </div>
      {children}
      <a href={next.href} className="flex min-h-11 items-center justify-center gap-3 text-xs text-muted-foreground">
        {next.label}
        <ArrowDown aria-hidden="true" className="size-4 text-landing-accent" />
      </a>
    </section>
  );
}

function Accent({ children }: { children: ReactNode }) {
  return <span className="text-landing-accent">{children}</span>;
}

function SelectedCheck({ on }: { on: boolean }) {
  return <Check aria-hidden="true" className={cn('ms-auto size-4 shrink-0 transition-opacity', on ? 'opacity-100' : 'opacity-0')} />;
}

function TicketRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <strong className="font-normal">{children}</strong>
    </div>
  );
}

export function LandingScreen() {
  const [houseId, setHouseId] = useState('');
  const [memoryId, setMemoryId] = useState('');

  const house = HOUSES.find(({ id }) => id === houseId);
  const memory = MEMORIES[memoryId as MemoryId] as (typeof MEMORIES)[MemoryId] | undefined;

  return (
    <Screen className="dark landing bg-background text-foreground">
      <header className="landing-header sticky top-0 z-30 -mb-[68px] flex h-[68px] items-center justify-between gap-3 bg-background/95 px-5">
        <span aria-hidden="true" className="landing-progress absolute inset-x-0 top-0 h-0.5 origin-[100%_50%] bg-landing-accent" />
        <a href="#top" className="flex min-h-11 items-center gap-1.5 text-2xl font-bold tracking-tighter">
          هم‌داستان
          <span aria-hidden="true" className="mt-3 size-1.5 rounded-full bg-landing-accent" />
        </a>
        <a href="#invitation" className="flex min-h-11 items-center gap-2 rounded-xl border border-foreground/20 px-3 text-xs">
          دعوت‌نامه‌ات
          <Mail aria-hidden="true" className="size-4" />
        </a>
      </header>

      <ScreenBody className="px-0 pb-0">
        <section id="top" aria-labelledby="landing-title" className="relative isolate h-[calc(100dvh-5.5rem)] min-h-[640px] max-h-[1000px] overflow-hidden">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 bottom-1/4 -z-20">
            <Image src={CASTLE} alt="" fill priority sizes={IMAGE_SIZES} className="object-cover object-[66%_40%]" />
          </div>
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,var(--color-background)_10%,color-mix(in_srgb,var(--color-background)_96%,transparent)_21%,color-mix(in_srgb,var(--color-background)_80%,transparent)_35%,color-mix(in_srgb,var(--color-background)_14%,transparent)_59%,color-mix(in_srgb,var(--color-background)_5%,transparent)_76%,color-mix(in_srgb,var(--color-background)_44%,transparent)_100%)]" />
          <Image
            src={OWL}
            alt="جغدی سفید با دعوت‌نامه‌ی تو"
            width={1000}
            height={667}
            priority
            sizes="190px"
            className="landing-owl pointer-events-none absolute end-[1%] top-[20%] z-10 w-[190px] -rotate-12 drop-shadow-2xl"
          />

          <div className="absolute inset-x-4 bottom-[155px] z-20 flex flex-col items-center text-center">
            <p className="flex items-center gap-2 text-xs text-foreground/85 animate-in fade-in slide-in-from-bottom-4 delay-100 duration-700 fill-mode-backwards motion-reduce:animate-none">
              <span aria-hidden="true" className="text-lg leading-none text-landing-accent">✦</span>
              دعوت‌نامه برای پاترهدها
            </p>
            <h1 id="landing-title" className="mt-3.5 text-[2.375rem] leading-[1.55] font-bold tracking-tight animate-in fade-in slide-in-from-bottom-4 delay-200 duration-700 fill-mode-backwards motion-reduce:animate-none">
              پاترهدی؟
              <br />
              اینجا <span className="whitespace-nowrap text-landing-accent underline decoration-landing-accent/50 decoration-2 underline-offset-8">آدم‌های</span>
              <br />
              خودت رو پیدا کن.
            </h1>
            <p className="mt-3.5 text-sm text-foreground/70 animate-in fade-in slide-in-from-bottom-4 delay-300 duration-700 fill-mode-backwards motion-reduce:animate-none">
              هم‌داستان، جای هوادارهاست.
            </p>
            <Button asChild variant="secondary" size="xl" className="mt-6 min-w-[246px] justify-between animate-in fade-in slide-in-from-bottom-4 delay-500 duration-700 fill-mode-backwards motion-reduce:animate-none">
              <a href="#world">
                هم‌قبیله‌هام کجان؟
                <ArrowLeft aria-hidden="true" />
              </a>
            </Button>
          </div>

          <div className="absolute inset-x-4 bottom-0 z-20">
            <a href="#world" className="flex min-h-11 items-center justify-center gap-2 text-xs text-foreground/60">
              داستان از اینجا شروع می‌شه
              <ArrowDown aria-hidden="true" className="size-3.5" />
            </a>
            <nav aria-label="مسیر هم‌داستان" className="grid h-[76px] grid-cols-3 border-t border-foreground/15">
              {CHAPTERS.map(({ href, number, label }) => (
                <a key={href} href={href} className="flex flex-col items-center justify-center gap-1 border-foreground/10 text-xs not-first:border-s first:text-landing-accent">
                  <span className="opacity-50">{number}</span>
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </section>

        <Chapter
          id="world"
          number="۰۱"
          step="قدم اول · جهانِ تو"
          title={<>جهان محبوبت رو<br /><Accent>انتخاب کن.</Accent></>}
          description={<>اگه هنوز منتظر نامه‌ی هاگوارتزی،<br />از همین‌جا شروع کن.</>}
          next={{ href: '#people', label: 'خب، بقیه‌ی پاترهدها کجان؟' }}
        >
          <div className="landing-reveal px-2">
            <p id="house-label" className="mb-3 text-xs text-muted-foreground">راستی، گروهت کدومه؟</p>
            <ToggleGroup
              type="single"
              variant="outline"
              value={houseId}
              onValueChange={(value) => value && setHouseId(value)}
              aria-labelledby="house-label"
              spacing={2}
              className="grid w-full grid-cols-2"
            >
              {HOUSES.map(({ id, name, mark, color }) => (
                <ToggleGroupItem
                  key={id}
                  value={id}
                  className="h-[52px] justify-start rounded-xl border-foreground/15 px-2.5 text-[13px] data-[state=on]:border-foreground data-[state=on]:bg-transparent"
                >
                  <span aria-hidden="true" className={cn(SHIELD, color, 'h-[29px] w-[25px] text-base')}>{mark}</span>
                  {name}
                  <SelectedCheck on={id === houseId} />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p aria-live="polite" className="mt-3 min-h-6 text-xs text-muted-foreground">
              {house?.welcome ?? 'هر گروهی که باشی، اینجا هم‌داستانی.'}
            </p>
          </div>

          <div className="landing-reveal relative mx-auto aspect-[.85] w-[310px] max-w-[90%]">
            <div aria-hidden="true" className="absolute inset-y-0 start-[6%] end-0 rotate-[5deg] rounded-t-[160px] rounded-b-[20px] border border-landing-accent/40" />
            <figure className="absolute inset-y-3 start-[10%] end-[6%] overflow-hidden rounded-t-[160px] rounded-b-2xl shadow-2xl">
              <Image src={CASTLE} alt="تصویرسازی قلعه‌ای جادویی در میان مه و نور فیروزه‌ای" fill sizes="280px" className="object-cover object-[69%_center]" />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background to-transparent to-65%" />
              <span aria-hidden="true" className="absolute inset-x-0 bottom-[124px] mx-auto grid size-[38px] place-items-center rounded-full border border-foreground/35 text-landing-accent">
                <Sparkles className="size-4" />
              </span>
              <figcaption className="absolute inset-x-4 bottom-6 flex flex-col items-center gap-1 text-center">
                <span className="text-xs opacity-70">جهانِ</span>
                <strong lang="en" dir="ltr" className="font-serif text-[2.125rem] leading-tight font-normal tracking-tight">Harry Potter</strong>
                <span className="text-xs opacity-75">یه علاقه؛ هزار تا داستان مشترک.</span>
              </figcaption>
            </figure>
            <span className="absolute -start-3.5 top-[49%] flex rotate-[7deg] items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
              <Heart aria-hidden="true" className="size-4 text-landing-gryffindor" />
              همین‌جا، مالِ خودمونه.
            </span>
          </div>
        </Chapter>

        <Chapter
          id="people"
          number="۰۲"
          step="قدم دوم · آدم‌های تو"
          title={<>با آدم‌های<br /><Accent>هم‌قبیله‌ت</Accent> آشنا شو.</>}
          description={<>اونایی که با یه «همیشه»،<br />همه‌چیز رو می‌فهمن.</>}
          next={{ href: '#memories', label: 'حالا نوبتِ خاطره ساختنه' }}
        >
          {/* Laid out by coordinates, so LTR whatever the page's direction. */}
          <div dir="ltr" role="img" aria-label="تصویرسازی پاترهدهایی که پیرامون تو به هم وصل می‌شوند" className="landing-reveal relative aspect-square w-full">
            <svg aria-hidden="true" viewBox="0 0 600 600" className="absolute inset-0 size-full fill-none stroke-landing-accent/40">
              <circle cx="300" cy="300" r="141" strokeDasharray="4 7" />
              <circle cx="300" cy="300" r="228" />
              {FACES.map(({ left, top }) => (
                <line key={`${left}-${top}`} x1="300" y1="300" x2={left * 6} y2={top * 6} strokeDasharray="4 7" />
              ))}
            </svg>
            <div className="absolute inset-[36.5%] flex flex-col items-center justify-center rounded-full border border-landing-accent/40 bg-landing-teal/40 shadow-2xl">
              <span className="text-3xl leading-normal font-bold">تو</span>
              <span dir="rtl" className="text-[9px] text-foreground/65">وسطِ داستانی.</span>
            </div>
            {FACES.map(({ left, top, rotate, mark, color, crop }) => (
              <div
                key={crop}
                className="absolute z-10 w-[17%]"
                style={{ left: `${left}%`, top: `${top}%`, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}
              >
                <Avatar className="aspect-square size-auto w-full rounded-xl border border-foreground/25 after:rounded-xl">
                  <span
                    className="block size-full bg-no-repeat saturate-[.85]"
                    style={{ backgroundImage: `url(${FRIENDS})`, backgroundSize: '640% auto', backgroundPosition: crop }}
                  />
                </Avatar>
                <span className={cn(SHIELD, color, 'absolute -end-1 -bottom-1 h-[23px] w-5 text-xs')}>{mark}</span>
              </div>
            ))}
            <div dir="rtl" style={{ left: '1%' }} className="absolute top-[12%] z-20 -rotate-[4deg] rounded-lg border bg-card px-2.5 py-2 text-[10px] whitespace-nowrap shadow-lg">
              کی بازم پایه‌ی ماراتن فیلمه؟
            </div>
            <div dir="rtl" style={{ right: 0 }} className="absolute bottom-[9%] z-20 rotate-[3deg] rounded-lg border bg-card px-2.5 py-2 text-[10px] whitespace-nowrap shadow-lg">
              بالاخره آدم‌های خودمو پیدا کردم.
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">یه جهان مشترک، شروع یه «ما»ست.</p>
        </Chapter>

        <section id="memories" aria-labelledby="memories-title" className="relative isolate flex scroll-mt-16 flex-col overflow-clip px-4 pt-[4.5rem] pb-14">
          <span aria-hidden="true" className="absolute start-4 top-8 -z-10 text-[180px] leading-none font-bold text-foreground/[.03]">۰۳</span>
          <div className="px-2">
            <Eyebrow>قدم سوم · خاطره‌های ما</Eyebrow>
            <h2 id="memories-title" className="landing-reveal mt-4 text-[1.9375rem] leading-[1.6] font-bold tracking-tight">
              بیا با هم<br />تجربه و <Accent>خاطره بسازیم.</Accent>
            </h2>
            <p className="landing-reveal mt-4 text-sm leading-loose text-muted-foreground">
              از کل‌کل‌های پاتری تا دوباره دیدن فیلم‌ها؛ این بار با هم.
            </p>
          </div>

          <ToggleGroup
            type="single"
            value={memoryId}
            onValueChange={(value) => value && setMemoryId(value)}
            aria-label="دوست داری از کدام تجربه شروع کنی؟"
            spacing={4}
            className="mt-10 grid w-full grid-cols-2 items-start"
          >
            {(Object.keys(MEMORIES) as MemoryId[]).map((id) => {
              const on = id === memoryId;
              const wide = id === 'meetup';
              return (
                <ToggleGroupItem
                  key={id}
                  value={id}
                  className={cn(
                    'landing-reveal h-auto flex-col items-stretch gap-0 rounded-md border bg-card p-2 pb-3 text-start whitespace-normal shadow-xl transition-shadow',
                    'hover:bg-card hover:text-foreground data-[state=on]:border-foreground data-[state=on]:bg-card',
                    id === 'film' && '-rotate-[5deg]',
                    id === 'debate' && 'translate-y-5 rotate-[5deg]',
                    wide && 'col-span-2 mx-auto mt-4 w-[78%] -rotate-[3deg]'
                  )}
                >
                  <span className={cn('relative block overflow-hidden rounded-sm', wide ? 'aspect-[1.5]' : 'aspect-square')}>
                    {id === 'film' ? (
                      <>
                        <Image src={CASTLE} alt="هاگوارتز روی پرده‌ی یک فیلم‌پارتی" fill sizes="200px" className="object-cover object-[55%_center]" />
                        <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-gradient-to-t from-background/60 to-transparent">
                          <span className="grid size-[42px] place-items-center rounded-full border border-foreground/45 bg-background/25">
                            <Film className="size-5" />
                          </span>
                        </span>
                      </>
                    ) : null}
                    {id === 'debate' ? (
                      <span aria-hidden="true" className="flex size-full flex-col items-center justify-center gap-1 bg-landing-teal p-3.5 font-serif italic">
                        <span lang="en" dir="ltr" className="-rotate-[7deg] text-3xl">Always.</span>
                        <span className="font-sans text-[10px] not-italic text-foreground/50">یا</span>
                        <span lang="en" dir="ltr" className="rotate-[5deg] text-center text-[22px] leading-tight text-landing-gold">Until the<br />very end.</span>
                      </span>
                    ) : null}
                    {wide ? (
                      <Image src={FRIENDS} alt="تصویرسازی جمعی از پاترهدهای جوان که با هم می‌خندند" fill sizes="300px" className="object-cover object-[55%_center]" />
                    ) : null}
                    <span aria-hidden="true" className={cn('absolute end-2 top-2 grid size-[25px] place-items-center rounded-full bg-foreground text-background transition-opacity', on ? 'opacity-100' : 'opacity-0')}>
                      <Check className="size-[15px]" />
                    </span>
                  </span>
                  <span className="flex flex-col gap-2 px-1 pt-3">
                    <strong className={cn('leading-relaxed font-bold tracking-tight', wide ? 'text-sm' : 'text-[11px]')}>{MEMORIES[id].title}</strong>
                    <span className="flex items-center justify-between text-[10px] font-normal text-muted-foreground">
                      {MEMORIES[id].label}
                      <ArrowLeft aria-hidden="true" className="size-3.5 text-landing-accent" />
                    </span>
                  </span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <p aria-live="polite" className="mx-auto mt-8 min-h-10 max-w-xs text-center text-xs leading-loose text-muted-foreground">
            {memory ? `فصل اولِ دعوت‌نامه‌ات شد «${memory.label}».` : 'دوست داری از کدوم خاطره شروع کنی؟ روی عکسش بزن.'}
          </p>
        </section>

        <section id="invitation" aria-labelledby="invitation-title" className="flex scroll-mt-16 flex-col-reverse gap-8 overflow-clip bg-[radial-gradient(ellipse_at_25%_65%,color-mix(in_srgb,var(--color-landing-teal)_18%,transparent),transparent_55%)] px-4 pt-16 pb-[4.5rem]">
          <div className="flex flex-col items-center pt-3 text-center">
            <p className="landing-reveal flex items-center gap-2.5 text-xs">
              <Mail aria-hidden="true" className="size-5" />
              این دعوت‌نامه برای توئه.
            </p>
            <h2 id="invitation-title" className="landing-reveal mt-3 text-4xl leading-[1.55] font-bold tracking-tight">
              جای تو توی<br />این داستان <Accent>خالیه.</Accent>
            </h2>
            <p className="landing-reveal mt-3.5 text-sm text-muted-foreground">از یه علاقه‌ی مشترک، به یه «ما»ی تازه.</p>
            <span className="landing-reveal mt-4 text-xs text-muted-foreground">یه قصه‌ی خوب، با یه «سلام» شروع می‌شه.</span>
          </div>

          <div className="relative mx-auto mt-3 aspect-[1.05] w-[340px] max-w-[95%] [perspective:1000px]">
            <Image src={OWL} alt="جغد سفید، دعوت‌نامه‌ی هم‌داستان را می‌رساند" width={1000} height={667} sizes="200px" className="pointer-events-none absolute -end-[4%] -top-12 z-40 w-[52%] -rotate-12 drop-shadow-2xl" />
            <div aria-hidden="true" className="absolute inset-x-[6%] top-[43%] h-[51%] -rotate-[7deg] rounded-xl border border-landing-teal/50 bg-landing-teal-deep" />
            <div aria-hidden="true" className="landing-flap absolute inset-x-[6%] top-[43%] h-[29%] origin-top rotate-x-[-160deg] bg-landing-teal-deep [clip-path:polygon(0_0,100%_0,50%_100%)]" />
            <div className="landing-ticket absolute inset-x-[12%] top-[17%] z-10">
              <Card className="min-h-[245px] -rotate-[7deg] gap-0 rounded-xl border-0 bg-foreground p-[18px] pb-0 text-background shadow-2xl [--muted-foreground:248_10%_40%]">
                <div className="flex items-center justify-between gap-2 border-b border-background/10 pb-2.5">
                  <span className="text-lg leading-none font-bold tracking-tighter">هم‌داستان <span className="text-landing-teal">✦</span></span>
                  <span lang="en" dir="ltr" className="text-[6px] leading-relaxed tracking-widest opacity-50">YOUR STORY<br />STARTS HERE</span>
                </div>
                <p className="my-3 text-sm font-bold tracking-tight">دعوت‌نامه‌ی یک پاترهد</p>
                <TicketRow label="مقصد">آدم‌های خودت</TicketRow>
                <TicketRow label="گروه">{house?.name ?? 'هر گروهی؛ یه هم‌داستان'}</TicketRow>
                <TicketRow label="فصلِ اول">{memory?.label ?? 'یه خاطره‌ی تازه'}</TicketRow>
                <div className="-mx-[18px] mt-4 flex items-center justify-between gap-1.5 border-t border-dashed border-background/25 px-[15px] py-3 text-[8px] whitespace-nowrap">
                  <span lang="en" dir="ltr" className="tracking-wider text-landing-teal">PLATFORM 9¾</span>
                  <Sparkles aria-hidden="true" className="size-3.5 text-landing-teal" />
                  <span>بلیتِ یک «ما»ی تازه</span>
                </div>
              </Card>
            </div>
            <div aria-hidden="true" className="absolute inset-x-[6%] top-[62%] z-20 h-[32%] -rotate-[7deg] rounded-b-xl bg-[linear-gradient(148deg,transparent_49.7%,var(--color-landing-teal)_50%),linear-gradient(-148deg,transparent_49.7%,var(--color-landing-teal)_50%)] bg-[length:51%_100%] bg-[position:0_0,100%_0] bg-no-repeat drop-shadow-xl">
              <span className="absolute inset-x-0 bottom-[12%] mx-auto grid size-10 place-items-center rounded-full bg-landing-gold text-background shadow-md ring-2 ring-landing-gold/60 ring-offset-2 ring-offset-landing-gold">
                <Sparkles className="size-[18px]" />
              </span>
            </div>
            <span aria-hidden="true" className="absolute end-[8%] -bottom-4 rotate-6 text-xs text-foreground/45">منتظرت بودیم.</span>
          </div>
        </section>
      </ScreenBody>

      <footer className="grid grid-cols-2 items-center gap-x-2 gap-y-5 border-t border-foreground/10 px-5 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <a href="#top" className="flex min-h-11 items-center gap-1.5 text-[22px] font-bold tracking-tighter">
          هم‌داستان
          <span aria-hidden="true" className="mt-3 size-1.5 rounded-full bg-landing-accent" />
        </a>
        <Button asChild variant="outline" size="icon" className="size-11 justify-self-end rounded-full bg-transparent">
          <a href="#top" aria-label="بازگشت به بالای صفحه">
            <ArrowUp aria-hidden="true" />
          </a>
        </Button>
        <small className="col-span-2 justify-self-center text-center text-[10px] leading-loose text-muted-foreground">
          هم‌داستان، جمعی مستقل از هوادارهاست؛ وابستگی رسمی به صاحبان مجموعه‌ی هری پاتر ندارد.
        </small>
      </footer>

      <ScreenFooter>
        <Button asChild size="xl" className="w-full justify-between">
          <Link href="/welcome">
            منم هم‌داستانم
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
