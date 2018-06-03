
class Order {

    constructor(exchange) {
        this.exchange = exchange;
    }

    setOrderType(orderType) {
        this.orderType = orderType;
        return this;
    }

    setQuantity(quantity) {
        this.quantity = quantity;
        return this;
    }

    setPrice(price){
        this.price = price;
        return this;
    }
}

module.exports = Order;