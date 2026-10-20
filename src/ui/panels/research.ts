import { BRANCHES, RESEARCH, RESEARCH_BY_ID, type Branch, type ResearchNode } from '../../data/research';
import { S } from '../../game/state';
import { buyResearchPoints, canResearch, research, researchGrantCost } from '../../game/actions';
import { h } from '../dom';
import { iconEl } from '../icons';
import { money } from '../format';
import { act } from './common';
import type { Panel } from './types';

export const researchPanel: Panel = {
  id: 'research', title: 'Research Lab', short: 'Research', icon: 'research', color: '#7a5cff', key: 'T',
  render,
};

const COL_W = 168;
const ROW_H = 92;
const NODE_W = 140;
const NODE_H = 74;
const LANE_LABEL = 26;

function nodeState(n: ResearchNode): 'done' | 'ready' | 'open' | 'locked' {
  const s = S();
  if (s.research.includes(n.id)) return 'done';
  if (n.requires.some((r) => !s.research.includes(r))) return 'locked';
  return canResearch(n.id).ok ? 'ready' : 'open';
}

function render(): HTMLElement {
  const s = S();
  // lay rows out lane by lane so each branch sits in its own coloured band
  const branches = Object.keys(BRANCHES) as Branch[];
  const rowY = new Map<number, number>();
  const lanes: { branch: Branch; top: number; height: number }[] = [];
  let y = 0;
  for (const b of branches) {
    const rows = [...new Set(RESEARCH.filter((n) => n.branch === b).map((n) => n.row))].sort((a, c) => a - c);
    const top = y;
    y += LANE_LABEL;
    for (const r of rows) {
      rowY.set(r, y);
      y += ROW_H;
    }
    lanes.push({ branch: b, top, height: y - top });
    y += 8;
  }
  const width = 3 * COL_W + 16;
  const height = y;
  const pos = (n: ResearchNode) => ({ x: 12 + n.tier * COL_W, y: rowY.get(n.row)! + 8 });

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'tree-links');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  for (const n of RESEARCH) {
    for (const req of n.requires) {
      const a = pos(RESEARCH_BY_ID[req]);
      const b = pos(n);
      const x1 = a.x + NODE_W;
      const y1 = a.y + NODE_H / 2;
      const x2 = b.x;
      const y2 = b.y + NODE_H / 2;
      const mid = (x1 + x2) / 2;
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`);
      path.setAttribute('class', s.research.includes(req) ? 'link on' : 'link');
      svg.appendChild(path);
    }
  }

  const tree = h('div.tree', { style: { width: `${width}px`, height: `${height}px` } },
    lanes.map((l) =>
      h('div.lane', { style: { top: `${l.top}px`, height: `${l.height}px`, '--lane': BRANCHES[l.branch].color } as any },
        h('span.lane-label', BRANCHES[l.branch].name)),
    ),
    svg,
    RESEARCH.map((n) => {
      const st = nodeState(n);
      const p = pos(n);
      const check = canResearch(n.id);
      return h(`button.node.${st}`, {
        style: { left: `${p.x}px`, top: `${p.y}px`, width: `${NODE_W}px`, height: `${NODE_H}px`, '--lane': BRANCHES[n.branch].color } as any,
        title: `${n.name}\n${n.desc}${!check.ok && st !== 'done' ? `\n\n${check.why}` : ''}`,
        disabled: st === 'done' || st === 'locked',
        onclick: act(() => research(n.id)),
      },
        h('span.node-emoji', st === 'locked' ? iconEl('lock', 16) : n.emoji),
        h('span.node-name', n.name),
        st === 'done'
          ? h('span.node-cost', 'Done')
          : h('span.node-cost', `${n.cost} RP · ${money(n.money)}`),
      );
    }),
  );

  const nextUp = RESEARCH.filter((n) => nodeState(n) === 'ready' || nodeState(n) === 'open');

  return h('div',
    h('div.rp-banner',
      h('div.rp-orb', h('span', Math.floor(s.rp).toString()), h('small', 'RP')),
      h('div',
        h('b', 'Research points'),
        h('p.hint', 'Every completed flight earns RP — longer flights earn more. Spend RP plus a bit of cash to unlock nodes.'),
        h('button.btn.small', { onclick: act(buyResearchPoints) }, `Lab grant: +5 RP · ${money(researchGrantCost())}`),
      ),
    ),
    h('div.tree-scroll', tree),
    h('div.legend',
      h('span.legend-item.done', 'Researched'),
      h('span.legend-item.ready', 'Affordable'),
      h('span.legend-item.open', 'Available'),
      h('span.legend-item.locked', 'Locked'),
    ),
    nextUp.length
      ? h('div.research-list',
          h('h3.section-title', 'Available now'),
          nextUp.map((n) => {
            const check = canResearch(n.id);
            return h('div.research-item', { style: { '--lane': BRANCHES[n.branch].color } as any },
              h('span.node-emoji', n.emoji),
              h('div', h('b', n.name), h('div.hint', n.desc), !check.ok && h('div.why', check.why)),
              h('button.btn.small.primary', { disabled: !check.ok, onclick: act(() => research(n.id)) }, `${n.cost} RP · ${money(n.money)}`),
            );
          }),
        )
      : h('p.hint', 'All research complete.'),
  );
}
