export default class Transaction
{
    constructor(raw, debug) // id, amount, sender, recipient
    {
        this.id = raw.id;
        this.amount = raw.amount;
        this.sender = raw.sender;
        this.recipient = raw.recipient;
        this.signature = raw.signature;

        this.timestamp = raw.timestamp // Date transaction created
        if (debug) {
            console.log(`New transaction ${this.id} of amount ${this.amount} by ${this.sender} to ${this.recipient} (${this.timestamp})`);
        }
    }
};