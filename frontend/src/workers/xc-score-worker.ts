import { solver, scoringRules } from 'igc-xc-score';
import { IGCFile } from 'igc-parser';

/* The joy of JS multithreading */
function filterFunc(o: any): object {
  const r: any = {};
  for (let k of Object.keys(o)) {
    if (typeof o[k] === 'function' || typeof o[k] === 'undefined' || o[k] === null)
      continue;
    else if (o[k] instanceof Array)
      r[k] = o[k];
    else if (typeof o[k] === 'object')
      r[k] = filterFunc(o[k]);
    else
      r[k] = o[k];
  }
  return r;
}

self.onmessage = function (msg: any) {
  if (msg.data.msg = 'xc-score-start') {
    const flight = <IGCFile>{ fixes: JSON.parse(msg.data.flight) };
    let rules: object | undefined = undefined;
    switch (msg.data.league) {
      case 'xc':
        rules = scoringRules.XContest;
        break;
      case 'fr':
        rules = scoringRules.FFVL;
        break;
    }
    if (rules === undefined)
      return;
    const it = solver(flight, rules, { maxcycle: 1000 });
    let s = it.next();
    while (!s.done) {
      self.postMessage({ msg: 'xc-score-progress', r: JSON.stringify(filterFunc(s.value)) });
      s = it.next();
    }
    self.postMessage({ msg: 'xc-score-result', r: JSON.stringify(filterFunc(s.value)) });
  }
};