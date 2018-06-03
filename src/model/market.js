
class Market {

    constructor(marketName) {
        this.marketName = marketName;
    }

    setBid(bid) {
        this.bid = bid;
        return this;
    }

    setAsk(ask) {
        this.ask = ask;
        return this;
    }

    setPervDay(prevDay) {
        this.prevDay = prevDay;
        return this;
    }
}

module.exports = Market;