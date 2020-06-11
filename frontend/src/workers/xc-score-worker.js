"use strict";
exports.__esModule = true;
var igc_xc_score_1 = require("igc-xc-score");
console.log('processor started');
self.onmessage = function (msg) {
    console.log('received', msg);
    console.log(self);
    if (msg.data.msg = 'xc-score') {
        var flight = { fixes: msg.data.flight };
        var it = igc_xc_score_1.solver(flight, igc_xc_score_1.scoringRules.FFVL, { maxcycle: 1000 });
        var s = it.next();
        while (!s.done) {
            console.log(s.value);
            self.postMessage({ msg: 'xc-score-result', r: s.value });
            s = it.next();
        }
        console.log('final', s.value);
        self.postMessage({ msg: 'xc-score-result', r: s.value });
    }
};
