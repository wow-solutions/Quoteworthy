// Apply iter-19 winning strategy (ESBE 1903 persona + extended thinking) to 4 real product topics.
// Goal: check whether the "encyclopedic 1903 style applied to modern content" recipe generalizes
// beyond «подбор кондиционера в комнату в Панаме» to adjacent SEO topics.
//
// Run: bun --env-file=.env.local scripts/voice-iter19-articles.ts

import Anthropic from "@anthropic-ai/sdk";
import { checkText, deriveDetectionScore } from "../lib/pangram";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SAMPLE_ESBE_FRIDGES = `Холодильники — Х. называются всякие приспособления для искусственного охлаждения. Искусственное охлаждение приобретает с каждым годом все большее значение в сельскохозяйственной промышленности и в торговле сельскохозяйственными продуктами, подверженными быстрой порче, каковы мясо, молоко, фрукты, рыба и т. п. Для хранения и перевозки некоторых из них требуется лишь поддержание низкой температуры, но всегда выше 0°, для других же требуются температуры ниже 0° — дичь, мясо, рыба, которые идут в продажу в замороженном виде. Искусственное охлаждение достигается во всех этих случаях или при помощи льда с примесью к нему поваренной соли, или посредством особых машин, производящих искусственное охлаждение помещений, предназначенных для хранения продуктов.

Лед употребляется для целей охлаждения не одинаково: 1) запасают лед в ледники, куда и выносят продукты для хранения. К этой категории относятся так назыв. на Волге выхода — ледники для посола рыбы, а также Х. на Дону и по Азовскому морю. 2) Заполняют льдом особые ящики-корма предназначенных для перевозки мяса и рыбы вагонов (рефригераторы) или шкафов для хранения провизии. При крупном деле и при большом количестве разнообразных продуктов, которые приходится охлаждать, выгоднее устраивать холодные склады с машинным охлаждением.

Охлаждение машинным путем основано на охлаждении или воздуха, сжатого и разрежаемого, или летучих жидкостей, превращающихся в газ (жидкие угольная кислота, сернистая кислота, аммиак). В Лондоне холодные склады имеются при центральном рынке и принадлежат особой компании. Колоссальные подвалы громадного лондонского мясного рынка служат этими складами и могут вместить до 60 тыс. пд. Все подземелье рынка представляет ряд больших камер с толстыми изолированными стенками; по потолку камер проходит труба, из которой в каждую камеру может быть впущен холодный воздух. Охладительный процесс основан на расширении сжатого воздуха, подобно тому как и в холодном складе в Париже.

Машинное охлаждение для хранения рыбы впервые было в России применено в Астрахани г. Супуком в 1888 г. Он сначала построил баржу-ледник, затем холодный склад в Астрахани. Еще в более крупном масштабе машинное охлаждение применено крупной рыбопромышленной фирмой Воробьева в Петровске, которая выстроила значительных размеров холодный склад (стоимостью в 200000 руб.). В самое последнее время Х. с машинным охлаждением построен на р. Куре (Божий промысел) фирмой Питоева; строится также фирмой Бр. Сапожниковых на р. Волге. Однако за отсутствием сплошной организации этого дела с устройством центральных холодных складов и полным подвижным составом в форме достаточного количества вагонов-Х. — широкого применения искусственного охлаждения в России — пока не существует, хотя есть все выгодные условия для его развития.`;

const ESBE_PERSONA = "Ты пишешь статью на русском в стиле энциклопедии конца XIX века. Изучи образец ниже — это статья из Энциклопедического словаря Брокгауза и Ефрона (1890-1907). Воспроизведи её манеру буквально: архаичные обороты («каковы», «оный», «по существу дела», «так назыв.»), длинные сложные периоды с подчинениями, отступления-комментарии в скобках, отсылки к практике («впервые в России применено», «принадлежат особой компании»), ссылки на источники в конце. Никакого markdown. Никакого современного маркетингового языка. Пиши как анонимный автор словарной статьи конца XIX века.";

const SYSTEM = `${ESBE_PERSONA}\n\nОбразец:\n${SAMPLE_ESBE_FRIDGES}`;

const ARTICLES: Array<{ slug: string; title: string; user: string }> = [
  {
    slug: "1-energy-consumption",
    title: "Сколько электроэнергии потребляет кондиционер в Панаме? Руководство 2025",
    user: "Напиши статью на тему: сколько электроэнергии потребляет кондиционер в Панаме? Подробное руководство на 2025 год. Разбери типы приборов, тарифы Naturgy/ENSA, расчёт потребления, способы экономии.",
  },
  {
    slug: "2-optimal-temperature",
    title: "Какая температура кондиционера оптимальна в Панаме?",
    user: "Напиши статью на тему: какая температура кондиционера оптимальна для жилых помещений в Панаме? Разбери компромисс между комфортом и расходом электроэнергии, влияние влажности, рекомендации для сна, дневного пребывания, офисов.",
  },
  {
    slug: "3-maintenance-tropical",
    title: "Обслуживание кондиционеров в тропическом климате: техническое руководство для Панамы",
    user: "Напиши техническое руководство по обслуживанию кондиционеров в тропическом климате Панамы. Разбери очистку фильтров, дезинфекцию испарителя, проверку хладагента, обслуживание наружного блока, периодичность работ в условиях высокой влажности и солёного воздуха.",
  },
  {
    slug: "4-installation-cost",
    title: "Сколько стоит установка кондиционера в Панаме? Справочник по ценам 2025",
    user: "Напиши справочник по ценам на установку кондиционера в Панаме на 2025 год. Разбери стоимость самого прибора по мощности, цены монтажа, дополнительные материалы (медные трубки, дренаж, крепления), стоимость работ в Панама-Сити vs провинция, гарантии.",
  },
];

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 6000;
const THINKING = { type: "enabled" as const, budget_tokens: 4000 };

const OUT_DIR = resolve(import.meta.dir, "../../../raw/experiments/voice-mirror/iter19-articles");

async function runArticle(article: typeof ARTICLES[number]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const client = new Anthropic({ apiKey });

  console.log(`\n=== ${article.slug}: ${article.title} ===`);

  const c0 = Date.now();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: THINKING,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: article.user }],
  });
  const claudeMs = Date.now() - c0;

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) throw new Error(`No text for ${article.slug}`);

  const p0 = Date.now();
  const pangram = await checkText(text);
  const pangramMs = Date.now() - p0;

  const score = deriveDetectionScore(pangram);

  const artifact = {
    slug: article.slug,
    title: article.title,
    user_message: article.user,
    system_prompt: SYSTEM,
    strategy: { name: "iter19-replay", model: MODEL, max_tokens: MAX_TOKENS, thinking: THINKING },
    output: text,
    pangram: {
      prediction: pangram.prediction,
      prediction_short: pangram.prediction_short,
      fraction_human: pangram.fraction_human,
      fraction_ai: pangram.fraction_ai,
      fraction_ai_assisted: pangram.fraction_ai_assisted,
      num_human_segments: pangram.num_human_segments,
      num_ai_segments: pangram.num_ai_segments,
      num_ai_assisted_segments: pangram.num_ai_assisted_segments,
      windows: pangram.windows.map((w) => ({
        label: w.label,
        ai_assistance_score: w.ai_assistance_score,
        confidence: w.confidence,
        word_count: w.word_count,
        text_preview: w.text.slice(0, 120),
      })),
    },
    usage: {
      input_tokens: resp.usage.input_tokens,
      output_tokens: resp.usage.output_tokens,
      cache_read_input_tokens: resp.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: resp.usage.cache_creation_input_tokens ?? 0,
    },
    timing: { claude_ms: claudeMs, pangram_ms: pangramMs },
  };

  writeFileSync(`${OUT_DIR}/${article.slug}.json`, JSON.stringify(artifact, null, 2));

  console.log(`f_human: ${pangram.fraction_human.toFixed(3)} | score: ${score}/100 | ${pangram.prediction_short} | out_tokens: ${resp.usage.output_tokens}`);

  return { slug: article.slug, title: article.title, pangram, score, output_tokens: resp.usage.output_tokens };
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const results = [];
for (const article of ARTICLES) {
  try {
    results.push(await runArticle(article));
  } catch (err) {
    console.error(`!!! ${article.slug} FAILED: ${(err as Error).message}`);
  }
}

console.log("\n\n=== SUMMARY ===");
console.log("| # | Topic | f_human | score | prediction | tokens |");
console.log("|---|-------|---------|-------|------------|--------|");
for (const r of results) {
  console.log(`| ${r.slug} | ${r.title.slice(0, 60)} | ${r.pangram.fraction_human.toFixed(3)} | ${r.score}/100 | ${r.pangram.prediction_short} | ${r.output_tokens} |`);
}
