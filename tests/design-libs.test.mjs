// design 스킬: UI 라이브러리 선택 (skills/design/scripts/lib-plan.mjs, references/design-libraries.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plan, candidates, upsertLibSection, parseChoose, CATS, COMMON, BY_TYPE } from '../skills/design/scripts/lib-plan.mjs';

const names = (rows, key) => rows.find((r) => r.key === key);

test('lib-plan: 공통 5분야는 어떤 유형·스택이든 항상 들어간다', () => {
  assert.deepEqual(COMMON, ['css', 'icons', 'fonts', 'tokens', 'qa']);
  for (const type of Object.keys(BY_TYPE)) for (const stack of ['none', 'build', 'react']) {
    const keys = plan({ type, stack }).rows.map((r) => r.key);
    for (const c of COMMON) assert.ok(keys.includes(c), `${type}/${stack} 에 ${c}`);
  }
  assert.match(plan({ type: 'tool' }).markdown, /### 공통 \(모든 서비스 — 항상 포함\)/);
});

test('lib-plan: 유형별 질문 분야 + --needs 로 더한 분야만 질문이 된다', () => {
  const tool = plan({ type: 'tool', stack: 'react', needs: ['charts'] });
  assert.deepEqual(tool.rows.filter((r) => !r.common).map((r) => r.key), ['components', 'charts']);
  assert.equal(tool.questions.length, 2);
  assert.match(tool.questions[0], /^1\. 컴포넌트 라이브러리: \*\*shadcn\/ui\*\* 을 추천해요/);
  assert.deepEqual(plan({ type: 'landing' }).rows.filter((r) => !r.common).map((r) => r.key), ['motion']);
  assert.deepEqual(plan({ type: '게임' }).rows.filter((r) => !r.common).map((r) => r.key), ['game']);
  assert.equal(plan({ type: 'tool', needs: ['components'] }).rows.filter((r) => r.key === 'components').length, 1, '중복 없음');
});

test('lib-plan: 스택에 못 쓰는 후보는 걸러서 추천이 바뀐다', () => {
  assert.equal(names(plan({ type: 'tool', stack: 'react' }).rows, 'components').rec.id, 'shadcn');
  assert.equal(names(plan({ type: 'tool', stack: 'none' }).rows, 'components').rec.id, 'daisyui', 'React 전용은 제외');
  assert.equal(names(plan({ type: 'tool', stack: 'none' }).rows, 'css').rec.id, 'bootstrap', 'Tailwind 는 빌드 필요');
  assert.equal(names(plan({ type: 'tool', stack: 'build' }).rows, 'css').rec.id, 'tailwind');
  assert.equal(names(plan({ type: 'landing', stack: 'none' }).rows, 'motion').rec.id, 'motion');
  assert.deepEqual(candidates('charts', 'none').ok.map((i) => i.id), ['chartjs', 'echarts', 'd3']);
  assert.equal(candidates('charts', 'react').skipped, 0);
  assert.equal(candidates('charts', 'none').skipped, 1);
});

test('lib-plan: 모든 분야의 후보는 3~5개이고 스택마다 최소 1개는 쓸 수 있다', () => {
  for (const [k, c] of Object.entries(CATS)) {
    assert.ok(c.items.length >= 3 && c.items.length <= 5, `${k} 후보 수`);
    assert.equal(new Set(c.items.map((i) => i.id)).size, c.items.length, `${k} id 중복`);
    if (k !== 'native') assert.ok(candidates(k, 'none').ok.length >= 1, `${k} none`);   // 네이티브는 React 스택 고정
    assert.ok(candidates(k, 'react').ok.length >= 3, `${k} react`);
  }
});

test('lib-plan: 선택은 기록하고, 안 고른 것은 추천(확인 전)·자동 모드는 (가정)', () => {
  const asked = plan({ type: 'tool', stack: 'build', needs: ['charts'], choose: { css: 'pico', charts: 'echarts' } });
  assert.match(asked.markdown, /\| CSS 틀 \| Pico CSS \|/);
  assert.match(asked.markdown, /\| 차트·데이터 시각화 \| Apache ECharts \|/);
  assert.match(asked.markdown, /\| 컴포넌트 라이브러리 \| daisyUI \(추천 — 확인 전\) \|/);
  assert.equal(asked.questions.length, 1, '고른 분야는 다시 묻지 않는다');
  const auto = plan({ type: 'landing', stack: 'none', auto: true });
  assert.match(auto.markdown, /Motion \(Framer Motion\) \(가정\)/);
  assert.equal(auto.questions.length, 0);
});

test('lib-plan: 모바일 네이티브는 스택을 React 로 본다', () => {
  const r = plan({ type: 'native', stack: 'none' });
  assert.equal(names(r.rows, 'native').rec.id, 'rn-paper');
  assert.match(r.markdown, /스택: React·Next\.js/);
});

test('lib-plan: 잘못된 입력은 이유를 알려 준다', () => {
  assert.throws(() => plan({ type: 'blog' }), /모르는 유형/);
  assert.throws(() => plan({ type: 'tool', stack: 'vue' }), /모르는 스택/);
  assert.throws(() => plan({ type: 'tool', needs: ['sound'] }), /모르는 분야/);
  assert.throws(() => plan({ type: 'tool', choose: { css: 'foundation' } }), /가 없어요/);
  assert.throws(() => plan({ type: 'tool', stack: 'none', choose: { css: 'tailwind' } }), /쓸 수 없어요/);
  assert.throws(() => plan({ type: 'tool', choose: { charts: 'chartjs' } }), /필요한 분야가 아니에요/);
});

test('lib-plan: shadcn/ui 는 shadcn MCP, --figma 는 Figma MCP 를 권한다', () => {
  const r = plan({ type: 'tool', stack: 'react', figma: true, choose: { components: 'shadcn' } });
  assert.ok(r.follow.some((f) => /shadcn MCP/.test(f)));
  assert.ok(r.follow.some((f) => /Figma MCP/.test(f)));
  assert.doesNotMatch(plan({ type: 'tool', stack: 'none' }).markdown, /같이 쓰면 좋은 연동/);
});

test('lib-plan: Pro 판은 쓰지 않고 한글 글꼴은 오픈 라이선스만', () => {
  const md = plan({ type: 'landing', stack: 'react' }).markdown;
  assert.match(md, /유료\(Pro\) 판은 쓰지 않는다/);
  assert.deepEqual(CATS.fonts.items.map((i) => i.id), ['pretendard', 'noto-sans-kr', 'suit']);
});

test('lib-plan: PROJECT.md — 도구 계획 바로 뒤에 넣고 다시 쓰면 바꾼다(다른 절 그대로)', () => {
  const doc = '# P\n\n## 사람 할 일\n- [ ] a\n\n## 디자인 도구 계획\n계획\n\n## 로드맵\n- [ ] I1\n';
  const once = upsertLibSection(doc, '## UI 라이브러리\n첫판\n');
  assert.match(once, /## 디자인 도구 계획\n계획\n\n## UI 라이브러리\n첫판\n\n## 로드맵/);
  const twice = upsertLibSection(once, '## UI 라이브러리\n둘째\n');
  assert.equal(twice.match(/## UI 라이브러리/g).length, 1);
  assert.match(twice, /둘째/);
  assert.match(twice, /## 사람 할 일\n- \[ \] a/);
  assert.match(upsertLibSection('# P\n\n## 로드맵\n- [ ] I1\n', '## UI 라이브러리\nx\n'), /## UI 라이브러리\nx\n\n## 로드맵/);
  assert.deepEqual(parseChoose('css=pico, charts=chartjs'), { css: 'pico', charts: 'chartjs' });
});

test('design SKILL.md: D0-1 이 공통·선택 분야·참고 문서를 가리키고 완료 조건에 들어 있다', () => {
  const s = readFileSync(new URL('../skills/design/SKILL.md', import.meta.url), 'utf8');
  assert.match(s, /### D0-1\. UI 라이브러리 선택/);
  assert.match(s, /references\/design-libraries\.md/);
  assert.match(s, /scripts\/lib-plan\.mjs/);
  assert.match(s, /공통 5분야/);
  assert.match(s, /분야마다 추천순 후보/);
  assert.match(s, /\[ \] UI 라이브러리\(D0-1\)/);
});
