import { solver, scoringRules } from 'igc-xc-score';
import { IGCFile } from 'igc-parser';

function filterFunc(o: any): object {
    const r: any = {};
    for (let k of Object.keys(o))
        switch (typeof o[k]) {
            case 'function':
                break;
            case 'object':
                if (o[k] !== null)
                    r[k] = filterFunc(o[k]);
                break;
            default:
                r[k] = o[k];
                break;
        }
    return r;
}

self.onmessage = function (msg: any) {
    if (msg.data.msg = 'xc-score') {
        const flight = <IGCFile>{ fixes: msg.data.flight };
        let rules: any;
        switch (msg.data.league) {
            case 'xc':
                rules = scoringRules.XContest;
                break;
            case 'FFVL':
                rules = scoringRules.FFVL;
                break;
        }
        if (rules === undefined)
            return;
        const it = solver(flight, rules, { maxcycle: 1000 });
        let s = it.next();
        while (!s.done) {
            self.postMessage({ msg: 'xc-score-result', r: filterFunc(s.value) });
            s = it.next();
        }
        self.postMessage({ msg: 'xc-score-result', r: filterFunc(s.value) });
    }
};