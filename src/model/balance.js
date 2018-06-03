class Balance {

    constructor(currency) {
        this.currency = currency;
    }

    setBalance(balance) {
        this.balance = balance;
        return this;
    }

    setAvailable(available) {
        this.available = available;
        return this;
    }

    setPending(pending) {
        this.pending = pending;
        return this;
    }
}

module.exports = Balance;