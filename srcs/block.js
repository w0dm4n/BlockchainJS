export default class Block
{
    constructor(raw, debug) // index, transactions, nonce, hash, prevBlockHash
    {
        this.id = raw.id; // block Id
        this.transactions = raw.transactions; // new transactions
        this.nonce = raw.nonce; // Number that proof the creation of a new block by using pow
        this.hash = raw.hash; // hash strings that contains transactions
        this.prevBlockHash = raw.prevBlockHash;

        this.timestamp = raw.timestamp; // Date block created
        if (debug) {
            console.log(`New block ${this.id} with ${this.transactions.length} transactions waiting (${this.timestamp})`);
        }
    }
};