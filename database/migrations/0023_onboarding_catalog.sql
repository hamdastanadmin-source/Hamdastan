-- ═══════════════════════════════════════════════════════════════════════════
-- 0023 — the onboarding catalogs move into the database
--
-- Until now stage 1's interests and stage 2's questions were code
-- (`@hamdastan/config`), so changing a word meant a deploy. They become three
-- tables the admin panel edits, seeded below with exactly what the code held
-- — same ids, same option codes, same order — so nobody's saved answers or
-- interests change meaning.
--
--   v2_interest_categories      stage 1's categories, in display order
--   v2_interests                the interests in each category
--   v2_questionnaire_questions  stage 2's questions, their options inline
--
-- The question-id and presentation-index CHECKs on the answer tables are
-- loosened: a question added from the panel has a generated id, and the
-- questionnaire is no longer exactly twenty long. No row is changed by that.
--
-- Additive otherwise: three new tables, three wider columns, two CHECKs
-- relaxed. Nothing is dropped.
--
-- Applied by `npm run db:migrate`, which opens the transaction — so no
-- BEGIN/COMMIT here — and, once applied, never edited.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Stage 1: interests ─────────────────────────────────────────────────────
-- Ids are the contract `v2_user_interests` stores. Seeded ones keep their
-- English slugs; the API generates ids for new ones, so an id is never
-- reused for something else after a delete. An interest never moves between
-- categories: audiences are matched on the category stored with each pick.
CREATE TABLE v2_interest_categories (
  id         varchar(40) PRIMARY KEY,
  title      varchar(80) NOT NULL,
  position   integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE v2_interests (
  id          varchar(40) PRIMARY KEY,
  category_id varchar(40) NOT NULL REFERENCES v2_interest_categories (id) ON DELETE CASCADE,
  label       varchar(80) NOT NULL,
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX v2_interests_category ON v2_interests (category_id, position);

-- ─── Stage 2: questions ─────────────────────────────────────────────────────
-- Presentation order is (section, position). `options` is the ordered list
-- of {code, label}; codes are what answers store, so they never change once
-- a question exists — only labels do. Sliders have none.
--
-- `scored` marks the twenty questions the scoring engine reads
-- (`onboarding.scoring.ts`). The API keeps their kind and option codes fixed
-- and refuses to delete them; their wording can still be edited. Questions
-- added from the panel are not scored: their answers are stored, not read.
CREATE TABLE v2_questionnaire_questions (
  id             varchar(40) PRIMARY KEY,
  section        smallint    NOT NULL
    CONSTRAINT v2_questionnaire_questions_section CHECK (section BETWEEN 1 AND 4),
  position       integer     NOT NULL DEFAULT 0,
  kind           varchar(8)  NOT NULL
    CONSTRAINT v2_questionnaire_questions_kind CHECK (kind IN ('single', 'multi', 'ranked', 'slider')),
  title          text        NOT NULL,
  helper         text,
  max_selections smallint
    CONSTRAINT v2_questionnaire_questions_max CHECK (max_selections IS NULL OR max_selections >= 1),
  min_label      varchar(80),
  max_label      varchar(80),
  options        jsonb       NOT NULL DEFAULT '[]',
  scored         boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX v2_questionnaire_questions_order ON v2_questionnaire_questions (section, position);

-- ─── Answers: room for generated question ids ───────────────────────────────
ALTER TABLE v2_questionnaire_answers
  DROP CONSTRAINT v2_questionnaire_answers_question_id,
  DROP CONSTRAINT v2_questionnaire_answers_presentation_index,
  ALTER COLUMN question_id TYPE varchar(40),
  ADD CONSTRAINT v2_questionnaire_answers_presentation_index CHECK (presentation_index >= 1);

ALTER TABLE v2_social_profiles
  ALTER COLUMN current_question_id TYPE varchar(40);

ALTER TABLE v2_onboarding_events
  ALTER COLUMN question_id TYPE varchar(40);

-- ─── Seed: the catalogs as the code held them ───────────────────────────────
INSERT INTO v2_interest_categories (id, title, position) VALUES
  ('music', 'موسیقی و اجرا', 1),
  ('art', 'هنر و خلاقیت', 2),
  ('learning', 'آموزش و مهارت', 3),
  ('lifestyle', 'تفریح و سبک زندگی', 4),
  ('social', 'اجتماعی و کسب‌وکار', 5),
  ('online', 'آنلاین', 6);

INSERT INTO v2_interests (id, category_id, label, position) VALUES
  ('concert', 'music', 'کنسرت', 1),
  ('theater', 'music', 'تئاتر', 2),
  ('cinema', 'music', 'سینما', 3),
  ('shows', 'music', 'ژانرهای شو', 4),
  ('live-music', 'music', 'موسیقی زنده', 5),
  ('rock', 'music', 'راک', 6),
  ('pop', 'music', 'پاپ', 7),
  ('rap', 'music', 'رپ', 8),
  ('electronic', 'music', 'الکترونیک', 9),
  ('traditional-music', 'music', 'سنتی', 10),
  ('gallery', 'art', 'گالری‌گردی', 1),
  ('painting', 'art', 'نقاشی', 2),
  ('photography', 'art', 'عکاسی', 3),
  ('sculpture', 'art', 'مجسمه', 4),
  ('architecture', 'art', 'معماری', 5),
  ('calligraphy', 'art', 'خوشنویسی', 6),
  ('pottery', 'art', 'سفالگری', 7),
  ('floristry', 'art', 'گل‌آرایی', 8),
  ('handicraft', 'art', 'دست‌سازه', 9),
  ('workshop', 'learning', 'ورکشاپ', 1),
  ('course', 'learning', 'دوره آموزشی', 2),
  ('seminar', 'learning', 'سمینار', 3),
  ('bootcamp', 'learning', 'بوت‌کمپ', 4),
  ('mentorship', 'learning', 'منتورشیپ', 5),
  ('reading', 'learning', 'مطالعه و کتاب', 6),
  ('history-heritage', 'learning', 'تاریخ و میراث', 7),
  ('running', 'lifestyle', 'دویدن', 1),
  ('football', 'lifestyle', 'فوتبال', 2),
  ('yoga', 'lifestyle', 'یوگا', 3),
  ('bodybuilding', 'lifestyle', 'بدنسازی', 4),
  ('cafe', 'lifestyle', 'کافه', 5),
  ('persian-food', 'lifestyle', 'غذای ایرانی', 6),
  ('hiking', 'lifestyle', 'کوهنوردی', 7),
  ('picnic', 'lifestyle', 'پیک‌نیک', 8),
  ('solo-travel', 'lifestyle', 'سفر تنهایی', 9),
  ('board-games', 'lifestyle', 'بوردگیم', 10),
  ('video-games', 'lifestyle', 'بازی‌های ویدیویی', 11),
  ('startup', 'social', 'استارتاپ', 1),
  ('technology', 'social', 'فناوری', 2),
  ('networking', 'social', 'شبکه‌سازی', 3),
  ('meetup', 'social', 'دورهمی', 4),
  ('charity', 'social', 'خیریه', 5),
  ('podcast-live', 'social', 'پادکست / رویداد زنده', 6),
  ('webinar', 'online', 'وبینار', 1),
  ('online-class', 'online', 'کلاس آنلاین', 2),
  ('streaming', 'online', 'استریمینگ', 3),
  ('virtual-event', 'online', 'رویداد مجازی', 4);

INSERT INTO v2_questionnaire_questions
  (id, section, position, kind, title, helper, max_selections, min_label, max_label, options, scored)
VALUES
  ('Q2', 1, 1, 'single', 'وقتی وارد جمعی می‌شی که هیچ‌کس رو نمی‌شناسی، معمولاً چه رفتاری داری؟', NULL, NULL, NULL, NULL,
   '[{"code":"INITIATES","label":"خودم معمولاً شروع‌کننده گفتگو هستم."},{"code":"JOINS_EASILY","label":"اگر کسی شروع کنه، راحت وارد گفتگو می‌شم."},{"code":"OBSERVES_FIRST","label":"اول کمی فضا رو می‌سنجم و بعد وارد گفتگو می‌شم."},{"code":"LISTENER","label":"ترجیح می‌دم بیشتر شنونده باشم."}]', true),
  ('Q4', 1, 2, 'slider', 'بعد از چند ساعت تعامل با آدم‌های جدید معمولاً چه حسی داری؟', NULL, NULL, 'خیلی خسته می‌شم', 'انرژی می‌گیرم',
   '[]', true),
  ('Q5', 1, 3, 'single', 'برای راحت شدن با آدم‌های جدید معمولاً چقدر زمان نیاز داری؟', NULL, NULL, NULL, NULL,
   '[{"code":"MINUTES","label":"چند دقیقه"},{"code":"HALF_HOUR","label":"حدود نیم ساعت"},{"code":"ONE_TWO_HOURS","label":"یک یا دو ساعت"},{"code":"SEVERAL_MEETINGS","label":"معمولاً چند بار دیدن لازم دارم"}]', true),
  ('Q19', 1, 4, 'single', 'اندازه گروه ایده‌آل برای تو چقدره؟', NULL, NULL, NULL, NULL,
   '[{"code":"SMALL","label":"۲ تا ۳ نفر"},{"code":"MEDIUM","label":"۴ تا ۶ نفر"},{"code":"LARGE","label":"۷ تا ۱۰ نفر"},{"code":"XL","label":"بیشتر از ۱۰ نفر"}]', true),
  ('Q3', 1, 5, 'multi', 'توی یک جمع جدید، معمولاً کدوم نقش‌ها بیشتر شبیه توئه؟', 'حداکثر ۲ مورد', 2, NULL, NULL,
   '[{"code":"INITIATOR","label":"شروع‌کننده گفتگو"},{"code":"FACILITATOR","label":"کسی که باعث می‌شه همه مشارکت کنن"},{"code":"ENERGIZER","label":"کسی که جو رو شاد می‌کنه"},{"code":"IDEATOR","label":"کسی که ایده و پیشنهاد می‌ده"},{"code":"ORGANIZER","label":"کسی که برنامه رو جلو می‌بره"},{"code":"LISTENER","label":"کسی که بیشتر گوش می‌ده"},{"code":"ANALYST","label":"کسی که تحلیل و نظر می‌ده"}]', true),
  ('Q6', 2, 6, 'multi', 'توی یه دورهمی، از چه مدل گفتگوهایی بیشتر لذت می‌بری؟', 'حداکثر ۳ مورد', 3, NULL, NULL,
   '[{"code":"LIGHT","label":"شوخی و گفتگوهای سبک"},{"code":"PERSONAL","label":"تجربه‌های شخصی"},{"code":"INTEREST","label":"فیلم، بازی، کتاب و هنر"},{"code":"DEEP","label":"ایده‌ها و موضوعات عمیق"},{"code":"PROFESSIONAL","label":"کار و تجربه‌های حرفه‌ای"},{"code":"STORY","label":"داستان‌های زندگی"}]', true),
  ('Q7', 2, 7, 'single', 'کدوم حالت بیشتر شبیه توئه؟', NULL, NULL, NULL, NULL,
   '[{"code":"ASKS_LISTENS","label":"بیشتر سؤال می‌پرسم و گوش می‌دم."},{"code":"SHARES_STORIES","label":"بیشتر تجربه‌ها و داستان‌هام رو تعریف می‌کنم."},{"code":"DEBATES","label":"بحث و تبادل‌نظر رو دوست دارم."},{"code":"CALM","label":"گفتگوی آروم و بدون فشار رو ترجیح می‌دم."}]', true),
  ('Q18', 2, 8, 'single', 'توی چه مدل گروهی احساس راحتی بیشتری می‌کنی؟', NULL, NULL, NULL, NULL,
   '[{"code":"SIMILAR","label":"آدم‌هایی شبیه خودم"},{"code":"MIXED","label":"ترکیبی از آدم‌های مشابه و متفاوت"},{"code":"ANY","label":"مهم نیست؛ فقط تجربه خوبی باشه"}]', true),
  ('Q20', 2, 9, 'multi', 'چی می‌تونه یه جمع خوب رو برات خراب کنه؟', 'حداکثر ۳ مورد', 3, NULL, NULL,
   '[{"code":"LOW_SI_LOW_SE","label":"آدم‌های خیلی کم‌حرف"},{"code":"HIGH_DOMINANCE","label":"کسی که کل گفتگو رو در دست می‌گیره"},{"code":"LIFESTYLE_DISTANCE","label":"اختلاف زیاد در سبک زندگی"},{"code":"HIGH_CP","label":"رقابت بیش از حد"},{"code":"LOW_INTEREST_OVERLAP","label":"نداشتن موضوع یا علاقه مشترک"},{"code":"LOW_ST_LOW_PU","label":"بی‌نظمی"},{"code":"HIGH_SE_SP_DISTANCE","label":"اختلاف زیاد در سطح انرژی"}]', true),
  ('Q1', 2, 10, 'ranked', 'از یه تجربه گروهی خوب، بیشتر دنبال چی هستی؟', 'تا ۳ مورد انتخاب کن.', 3, NULL, NULL,
   '[{"code":"SOCIAL","label":"آشنایی با آدم‌های جدید"},{"code":"FUN","label":"خوش‌گذرونی و خندیدن"},{"code":"DISCOVERY","label":"تجربه چیزهای جدید"},{"code":"LEARNING","label":"یادگیری و گفتگو"},{"code":"COMPETITION","label":"رقابت و چالش"},{"code":"FRIENDSHIP","label":"پیدا کردن آدم‌هایی با علایق مشترک"},{"code":"NETWORKING","label":"شبکه‌سازی حرفه‌ای"},{"code":"ESCAPE","label":"خارج شدن از روزمرگی"},{"code":"MEMORABLE","label":"داشتن یه تجربه خاص و متفاوت"}]', true),
  ('Q8', 3, 11, 'slider', 'فعالیت آروم رو ترجیح می‌دی یا هیجان‌انگیز؟', NULL, NULL, 'کاملاً آروم', 'خیلی هیجان‌انگیز',
   '[]', true),
  ('Q9', 3, 12, 'slider', 'توی یک تجربه گروهی، کدوم برات مهم‌تره؟', NULL, NULL, 'خودِ گفتگو', 'خودِ فعالیت',
   '[]', true),
  ('Q11', 3, 13, 'slider', 'توی بازی یا فعالیت رقابتی، بردن چقدر برات مهمه؟', NULL, NULL, 'برد مهم نیست', 'رقابت خیلی مهمه',
   '[]', true),
  ('Q12', 3, 14, 'single', 'توی فعالیت گروهی کدوم مدل رو بیشتر دوست داری؟', NULL, NULL, NULL, NULL,
   '[{"code":"COOPERATIVE","label":"همه با هم همکاری کنیم"},{"code":"FRIENDLY_COMPETITION","label":"یه رقابت دوستانه هم داشته باشیم"},{"code":"SERIOUS_COMPETITION","label":"رقابت جدی‌تر برام جذاب‌تره"}]', true),
  ('Q13', 3, 15, 'single', 'برای تجربه‌های جدید، کدوم حالت بیشتر شبیه توئه؟', NULL, NULL, NULL, NULL,
   '[{"code":"FAMILIAR","label":"بیشتر چیزهایی رو انتخاب می‌کنم که از قبل می‌شناسم."},{"code":"MIXED","label":"ترکیبی از تجربه‌های آشنا و تازه رو دوست دارم."},{"code":"NEW","label":"دوست دارم چیزهای کاملاً جدید رو امتحان کنم."}]', true),
  ('Q10', 4, 16, 'single', 'معمولاً کدوم مدل برنامه رو ترجیح می‌دی؟', NULL, NULL, NULL, NULL,
   '[{"code":"DETAILED","label":"برنامه دقیق و مشخص"},{"code":"FLEXIBLE","label":"یه چارچوب کلی داشته باشیم ولی انعطاف هم باشه"},{"code":"SPONTANEOUS","label":"همون لحظه تصمیم بگیریم"}]', true),
  ('Q14', 4, 17, 'single', 'اگر گروه فعالیتی رو انتخاب کنه که انتخاب اول تو نیست، معمولاً چیکار می‌کنی؟', NULL, NULL, NULL, NULL,
   '[{"code":"GOES_ALONG","label":"معمولاً همراه می‌شم و امتحانش می‌کنم."},{"code":"IF_GOOD_REASON","label":"اگه دلیل خوبی داشته باشه، موافقم."},{"code":"OWN_CHOICE","label":"ترجیح می‌دم روی انتخاب خودم بمونم."}]', true),
  ('Q15', 4, 18, 'multi', 'چه زمان‌هایی معمولاً برای فعالیت اجتماعی برات مناسب‌تره؟', 'هر چند مورد که مناسبه انتخاب کن.', NULL, NULL, NULL,
   '[{"code":"MORNING","label":"صبح"},{"code":"AFTERNOON","label":"بعدازظهر"},{"code":"EVENING","label":"شب"},{"code":"WEEKEND","label":"آخر هفته"}]', true),
  ('Q16', 4, 19, 'slider', 'توی فعالیت‌های اجتماعی، کدوم طرف بیشتر شبیه توئه؟', NULL, NULL, 'اقتصادی‌تر', 'کیفیت تجربه مهم‌تره',
   '[]', true),
  ('Q17', 4, 20, 'slider', 'توی فعالیت گروهی، زمان‌بندی چقدر برات مهمه؟', NULL, NULL, 'خیلی منعطفم', 'سر وقت بودن مهمه',
   '[]', true);
