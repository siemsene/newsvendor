"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profitForDay = profitForDay;
function profitForDay(D, Q, price, cost, salvage) {
    const sold = Math.min(Q, D);
    const leftover = Math.max(0, Q - sold);
    return price * sold + salvage * leftover - cost * Q;
}
