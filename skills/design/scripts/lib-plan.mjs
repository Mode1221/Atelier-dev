#!/usr/bin/env node
// 디자인 단계 UI 라이브러리 선택 (design D0-1) — 분야별 후보를 추천순으로 놓고, 스택에 못 쓰는 것은 걸러서
// PROJECT.md "## UI 라이브러리" 절에 선택을 남긴다. 기준 문서: references/design-libraries.md
//   node lib-plan.mjs --type tool|emotional|landing|game|native [--stack none|build|react] [--needs charts,components,motion]
//                     [--figma] [--choose css=pico,charts=chartjs] [--auto] [--write PROJECT.md]
// 하는 일: ① 공통 5분야(css·icons·fonts·tokens·qa)는 항상 넣는다 ② 서비스 유형·--needs 로 정해진 분야는 질문으로 만든다
//          ③ --choose 로 받은 선택을 기록(안 받은 것은 추천 1순위 — --auto 면 "(가정)")
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ALIAS } from './tool-plan.mjs';

// 스택: none = 빌드 없는 HTML·Workers(파일 연결·CDN) / build = npm 빌드 가능 / react = React·Next.js
export const STACKS = { none: 0, build: 1, react: 2 };
const STACK_LABEL = { none: '빌드 없는 HTML', build: '빌드 가능(npm)', react: 'React·Next.js' };

// 후보는 추천순(보편성·신뢰도·관리 상태) — 스택에 맞는 것 중 맨 앞이 추천. 인기·버전·라이선스는 도입 전에 공식 사이트로 확인한다.
export const CATS = {
  css: { label: 'CSS 틀', common: true, items: [
    { id: 'tailwind', name: 'Tailwind CSS', needs: 'build', why: '사실상 표준, 자료·예제가 가장 많음', note: '운영에는 빌드(CLI) 필요 — 개발 전용 CDN 은 운영에 쓰지 않는다' },
    { id: 'bootstrap', name: 'Bootstrap', needs: 'none', why: '가장 오래되고 안정적, 빌드 없이 파일만 연결' },
    { id: 'pico', name: 'Pico CSS', needs: 'none', why: '클래스 없이 태그만으로 깔끔하고 가장 가벼움' },
    { id: 'unocss', name: 'UnoCSS', needs: 'build', why: 'Tailwind 호환, 가볍고 빠름' },
  ] },
  icons: { label: '아이콘', common: true, items: [
    { id: 'lucide', name: 'Lucide', needs: 'none', why: '가장 많이 쓰이는 오픈소스 아이콘(SVG)' },
    { id: 'heroicons', name: 'Heroicons', needs: 'none', why: 'Tailwind 제작팀, 깔끔한 기본형' },
    { id: 'phosphor', name: 'Phosphor Icons', needs: 'none', why: '굵기·스타일 선택 폭이 넓음' },
    { id: 'tabler', name: 'Tabler Icons', needs: 'none', why: '종류가 많음(5천 개 이상)' },
  ] },
  fonts: { label: '글꼴(한글)', common: true, items: [
    { id: 'pretendard', name: 'Pretendard', needs: 'none', why: '한글 웹 서비스의 사실상 표준(오픈 라이선스)' },
    { id: 'noto-sans-kr', name: 'Noto Sans KR', needs: 'none', why: 'Google Fonts, 가장 안정적' },
    { id: 'suit', name: 'SUIT', needs: 'none', why: '둥근 인상의 한글 글꼴(오픈 라이선스)' },
  ] },
  tokens: { label: '디자인 토큰·색', common: true, items: [
    { id: 'own', name: '자체 CSS 변수 토큰', needs: 'none', why: 'design-tokens.md 구조 그대로, 추가 도구 없음(기본)' },
    { id: 'radix-colors', name: 'Radix Colors', needs: 'none', why: '라이트·다크 대비가 맞춰진 색 체계' },
    { id: 'open-props', name: 'Open Props', needs: 'none', why: '간격·그림자 등 CSS 변수 모음' },
    { id: 'style-dictionary', name: 'Style Dictionary', needs: 'build', why: '웹·앱 여러 곳에 토큰을 배포할 때만', note: '단일 웹이면 과함' },
  ] },
  qa: { label: '접근성·품질 검사', common: true, items: [
    { id: 'axe-playwright', name: 'axe-core + Playwright', needs: 'none', why: '접근성 자동 검사 표준 + 캡처 스크립트(Atelier 기본)' },
    { id: 'lighthouse', name: 'Lighthouse', needs: 'none', why: '성능·접근성·SEO 종합 점검' },
    { id: 'storybook', name: 'Storybook', needs: 'build', why: '컴포넌트 문서·시각 테스트', note: '컴포넌트가 많을 때만' },
  ] },
  components: { label: '컴포넌트 라이브러리', items: [
    { id: 'shadcn', name: 'shadcn/ui', needs: 'react', why: '현재 가장 많이 쓰임, 코드를 복사해 쓰는 방식', follow: 'shadcn MCP' },
    { id: 'mui', name: 'MUI (Material UI)', needs: 'react', why: '오래되고 부품이 가장 많음' },
    { id: 'radix-ui', name: 'Radix UI', needs: 'react', why: '접근성이 좋은 기반 부품(스타일은 직접)' },
    { id: 'daisyui', name: 'daisyUI', needs: 'none', why: 'Tailwind 계열 부품 모음, CDN 으로 시작 가능', note: 'CDN 용량·버전은 공식 문서로 확인' },
    { id: 'flowbite', name: 'Flowbite', needs: 'none', why: 'Tailwind 기반 HTML 부품, 무료판만 사용', note: 'Pro 는 쓰지 않는다' },
  ] },
  motion: { label: '효과·애니메이션', items: [
    { id: 'motion', name: 'Motion (Framer Motion)', needs: 'none', why: '표준 애니메이션 라이브러리, 바닐라 JS·React 모두' },
    { id: 'gsap', name: 'GSAP', needs: 'none', why: '복잡한 타임라인·스크롤 연출에 가장 강함' },
    { id: 'lottie', name: 'Lottie', needs: 'none', why: '디자이너가 만든 움직이는 아이콘·일러스트' },
    { id: 'magicui', name: 'Magic UI', needs: 'react', why: '랜딩용 효과 컴포넌트 모음', note: 'Pro 는 쓰지 않는다' },
  ] },
  charts: { label: '차트·데이터 시각화', items: [
    { id: 'chartjs', name: 'Chart.js', needs: 'none', why: '가장 쉽고 가벼움' },
    { id: 'echarts', name: 'Apache ECharts', needs: 'none', why: '기능이 가장 풍부함' },
    { id: 'recharts', name: 'Recharts', needs: 'react', why: 'React 프로젝트의 표준' },
    { id: 'd3', name: 'D3', needs: 'none', why: '가장 자유롭지만 어려움', note: '맞춤 시각화가 꼭 필요할 때만' },
  ] },
  game: { label: '게임·3D', items: [
    { id: 'phaser', name: 'Phaser', needs: 'none', why: '2D 웹 게임의 표준' },
    { id: 'threejs', name: 'Three.js', needs: 'none', why: '3D 의 표준' },
    { id: 'pixijs', name: 'PixiJS', needs: 'none', why: '가벼운 2D 렌더링' },
    { id: 'babylonjs', name: 'Babylon.js', needs: 'none', why: '3D 게임 엔진' },
  ] },
  native: { label: '모바일 앱 UI', items: [
    { id: 'rn-paper', name: 'React Native Paper', needs: 'react', why: 'Material 디자인 부품, 가장 무난함' },
    { id: 'nativewind', name: 'NativeWind', needs: 'react', why: 'Tailwind 문법을 앱에서' },
    { id: 'tamagui', name: 'Tamagui', needs: 'react', why: '웹·앱 공용 UI' },
  ] },
};

export const COMMON = Object.entries(CATS).filter(([, c]) => c.common).map(([k]) => k);
// 서비스 유형별로 기본 질문하는 분야 (나머지는 --needs 로 더한다: 화면에 그래프·통계가 있으면 charts, 폼·표·모달이 많으면 components)
export const BY_TYPE = { tool: ['components'], emotional: ['motion'], landing: ['motion'], game: ['game'], native: ['native'] };
const TYPES = Object.keys(BY_TYPE);

const norm = (t) => ALIAS[String(t ?? '').trim()] ?? String(t ?? '').trim();
const fits = (item, stack) => STACKS[item.needs] <= STACKS[stack];
const cat = (k) => { if (!CATS[k]) throw new Error(`모르는 분야 "${k}" (가능: ${Object.keys(CATS).join(', ')})`); return CATS[k]; };

/** 분야의 후보 → 스택에 맞는 것(추천순)과 걸러진 개수 */
export function candidates(key, stack) {
  const all = cat(key).items;
  const ok = all.filter((i) => fits(i, stack));
  return { ok, skipped: all.length - ok.length };
}

export function plan({ type, stack = 'none', needs = [], figma = false, choose = {}, auto = false }) {
  const t = norm(type);
  if (!TYPES.includes(t)) throw new Error(`모르는 유형 "${type}" (가능: ${TYPES.join(', ')})`);
  if (!(stack in STACKS)) throw new Error(`모르는 스택 "${stack}" (가능: ${Object.keys(STACKS).join(', ')})`);
  if (t === 'native') stack = 'react';   // 모바일 네이티브(Expo·React Native)는 React 스택
  const asked = [...new Set([...BY_TYPE[t], ...needs])].filter((k) => !CATS[k]?.common);
  for (const k of needs) cat(k);
  const keys = [...COMMON, ...asked];
  const picks = {};
  for (const [k, v] of Object.entries(choose)) {
    const c = cat(k);
    const item = c.items.find((i) => i.id === v);
    if (!item) throw new Error(`"${k}" 분야에 "${v}" 가 없어요 (가능: ${c.items.map((i) => i.id).join(', ')})`);
    if (!fits(item, stack)) throw new Error(`${item.name} 은(는) ${STACK_LABEL[stack]} 스택에서 쓸 수 없어요 (필요: ${STACK_LABEL[item.needs]})`);
    if (!keys.includes(k)) throw new Error(`"${k}" 는 이번 서비스에 필요한 분야가 아니에요 (--needs ${k} 로 더하세요)`);
    picks[k] = item;
  }
  const rows = keys.map((k) => {
    const { ok, skipped } = candidates(k, stack);
    if (!ok.length) throw new Error(`${CATS[k].label}: ${STACK_LABEL[stack]} 스택에 맞는 후보가 없어요`);
    const rec = ok[0];
    const chosen = picks[k];
    const status = chosen ? 'chosen' : auto ? 'assumed' : 'pending';
    const use = chosen ?? rec;
    return { key: k, label: CATS[k].label, common: Boolean(CATS[k].common), status, use, rec, others: ok.filter((i) => i !== use), skipped };
  });
  const follow = [
    ...rows.filter((r) => r.use.follow).map((r) => `${r.use.name} → ${r.use.follow} 설치를 권한다(부품을 찾아 바로 설치)`),
    ...(figma ? ['Figma 디자인이 있다 → Figma MCP 설치를 권한다(디자인 파일을 직접 읽음)'] : []),
  ];
  const mark = (r) => `${r.use.name}${r.status === 'assumed' ? ' (가정)' : r.status === 'pending' ? ' (추천 — 확인 전)' : ''}`;
  const table = (list) => list.map((r) => `| ${r.label} | ${mark(r)} | ${r.others.map((i) => i.name).join(' · ') || '—'} |`).join('\n');
  const md = [
    '## UI 라이브러리',
    `만든 날: ${new Date().toISOString().slice(0, 10)} · 유형: ${t} · 스택: ${STACK_LABEL[stack]} · 기준: atelier design/references/design-libraries.md · **이후 단계는 이 절만 읽고 다시 고르지 않는다.**`,
    '',
    '### 공통 (모든 서비스 — 항상 포함)',
    '| 분야 | 사용 | 다른 후보 |', '|---|---|---|', table(rows.filter((r) => r.common)),
    '',
    '### 이 서비스에서 고르는 것',
    ...(rows.some((r) => !r.common) ? ['| 분야 | 사용 | 다른 후보 |', '|---|---|---|', table(rows.filter((r) => !r.common))] : ['해당 없음 (공통만 사용)']),
    ...(follow.length ? ['', '### 같이 쓰면 좋은 연동', ...follow.map((f) => `- ${f}`)] : []),
    '',
    '규칙: 부품은 라이브러리 것을 쓰고 임의 CSS 는 최소로 · 설치·사용법은 공식 문서(가능하면 MCP)의 최신 내용을 따른다(명령을 외워 쓰지 않는다) · 유료(Pro) 판은 쓰지 않는다 · 라이선스를 docs/design.md 에 기록(guard G5).',
  ].join('\n');
  // 대표에게 던질 질문 (고르는 분야마다 하나) — 빠른 길은 한 번에 묶어서 묻는다
  const questions = rows.filter((r) => !r.common && r.status === 'pending').map((r, i) => {
    const alt = r.others.map((o) => `${o.name}(${o.why})`).join(' / ');
    return `${i + 1}. ${r.label}: **${r.rec.name}** 을 추천해요 — ${r.rec.why}.${alt ? ` 다른 후보: ${alt}.` : ''} (쓰지 않기도 가능)`;
  });
  return { markdown: `${md}\n`, rows, questions, follow };
}

// PROJECT.md 에 "## UI 라이브러리" 절을 넣거나 바꾼다 (다른 절은 그대로, "디자인 도구 계획" 바로 뒤에)
export function upsertLibSection(doc, section) {
  const re = /^## UI 라이브러리\n[\s\S]*?(?=^## |(?![\s\S]))/m;
  if (re.test(doc)) return doc.replace(re, `${section.trimEnd()}\n\n`);
  const after = /^## 디자인 도구 계획\n[\s\S]*?(?=^## |(?![\s\S]))/m.exec(doc);
  if (after) { const at = after.index + after[0].length; return `${doc.slice(0, at).trimEnd()}\n\n${section.trimEnd()}\n\n${doc.slice(at)}`; }
  const road = doc.search(/^## 로드맵/m);
  return road >= 0 ? `${doc.slice(0, road)}${section.trimEnd()}\n\n${doc.slice(road)}` : `${doc.trimEnd()}\n\n${section}`;
}

export function parseChoose(s) {
  return Object.fromEntries(String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const [k, v] = x.split('='); return [k.trim(), (v ?? '').trim()]; }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : undefined; };
  try {
    const r = plan({ type: get('type'), stack: get('stack') ?? 'none', needs: (get('needs') ?? '').split(',').filter(Boolean), figma: a.includes('--figma'), choose: parseChoose(get('choose')), auto: a.includes('--auto') });
    if (get('write')) writeFileSync(get('write'), upsertLibSection(readFileSync(get('write'), 'utf8'), r.markdown));
    console.log(r.markdown);
    if (r.questions.length) console.log(`대표에게 물을 것 (한 번에 묶어서):\n${r.questions.join('\n')}`);
  } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
}
