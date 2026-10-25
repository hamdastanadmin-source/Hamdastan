'use client';

import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hamdastan/ui';

import { NEUTRAL_TAB } from '@/components';

import { InterestsPanel } from './InterestsPanel';
import { QuestionsPanel } from './QuestionsPanel';

type Tab = 'interests' | 'questions';

/**
 * The two catalogs onboarding asks from: stage 1's interests and stage 2's
 * questionnaire. A change shows to the next person who opens that stage.
 */
export function OnboardingScreen() {
  const [tab, setTab] = useState<Tab>('interests');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">آنبوردینگ</h1>
        <p className="text-sm text-muted-foreground">علاقه‌مندی‌های مرحله‌ی اول و سؤال‌های پرسش‌نامه‌ی شخصیت‌شناسی مرحله‌ی دوم.</p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="interests" className={NEUTRAL_TAB}>
            علاقه‌مندی‌ها
          </TabsTrigger>
          <TabsTrigger value="questions" className={NEUTRAL_TAB}>
            پرسش‌نامه
          </TabsTrigger>
        </TabsList>
        <TabsContent value="interests" className="mt-4">
          <InterestsPanel />
        </TabsContent>
        <TabsContent value="questions" className="mt-4">
          <QuestionsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
