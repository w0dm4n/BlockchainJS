import Block from "./block.js"
import Transaction from "./transaction.js"
import Utils from "./utils.js"

const sha256 = require("sha256");
const uuid = require("uuid/v1");
const fs = require("fs");

const currentNodeUrl = process.argv[3];
export default class Blockchain
{
    constructor()
    {
        this.hash_need = "0000" // used to increase the difficulty
        this.chain = [];
        this.pendingTransactions = [];
        
        this.miningReward = 0.5;
        this.networkNodes = [];
        this.createNewBlock(0, '0', '0', []);

        //put max amount token on the 00 address that deliver to miners on the first block
        this.addNewNode(currentNodeUrl);
        this.currentNodeAddress();
    }

    generateNewWallet()
    {
        var EC = require('elliptic').ec;
        var ec = new EC('secp256k1');
        
        var key = ec.genKeyPair();
        let hexPub = "04" + key.getPublic().x.toString(16) + key.getPublic().y.toString(16);
        return {private_key: key.getPrivate().toString(16), public_key: hexPub};
    }

    currentNodeAddress()
    {
        try {
            let contents = fs.readFileSync("node_address.json");
            return JSON.parse(contents.toString());
        }
        catch (e) 
        {
            let wallet = this.generateNewWallet();
            fs.writeFileSync("node_address.json", JSON.stringify(wallet), "utf8");
            return wallet;
        }
    }

    findPendingTransaction(id)
    {
        let i = 0;
        for (var transaction of this.pendingTransactions) {
            if (transaction.id == id) {
                return i;
            }
            i++;
        }
        return -1;
    }

    clearInBlockTransaction(block) {
        for (var transaction of block.transactions) {
            let index = this.findPendingTransaction(transaction.id);
            if (index != -1) {
                this.pendingTransactions.splice(index, 1);
                //console.log(`Transaction ${transaction.id} verified by block ${block.id}`);
            }
        }
    }

    checkNewBlock(block)
    {
        for (var transaction of block.transactions) {
            let sender = this.getAddressData(transaction.sender);
            if (sender.balance < transaction.amount) {
                return false;
            }
        }
        return true;
    }

    createNewBlock(nonce, prevBlockHash, hash, transactions) {
        let block = new Block({
                id: this.getNewBlockIndex(), 
                transactions: transactions, 
                nonce: nonce,
                hash: hash,
                prevBlockHash: prevBlockHash,
                timestamp: Date.now() }, false);
        
        this.clearInBlockTransaction(block);
        this.chain.push(block);
        return block;
    }

    addNewBlock(fromRaw) {
        let block = new Block(fromRaw);

        this.clearInBlockTransaction(block);
        this.chain.push(block);
        return block;
    }

    addNewNode(nodeUrl) {
        if (this.networkNodes.indexOf(nodeUrl) == -1) {
            this.networkNodes.push(nodeUrl);
        }
    }

    setBulkNodes(nodes) {
        this.networkNodes = nodes;
    }

    removeNode(nodeUrl) {
        let index = this.networkNodes.indexOf(nodeUrl);
        if (index) {
            this.networkNodes.splice(index, 1);
        }
    }

    getNewBlockIndex() {
        let block = this.getLastBlock();
        return (block) ? (block.id + 1) : 1;
    }

    getNewTransactionIndex() {
        return uuid().split('-').join('');
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    hashBlock(prevBlockHash, currentBlockData, nonce) {
        let rawData = prevBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
        let blockHash = sha256(rawData);

        return blockHash;
    }

    proofOfWork(prevBlockHash, currentBlockData) {
        let nonce = 0;
        let hash = this.hashBlock(prevBlockHash, currentBlockData, nonce);

        // find a way to handle the powerness of cpu fucked by the mining process
        console.log(`Mining a new block... (${this.pendingTransactions.length} pending transactions)`);
        while (hash.substring(0, this.hash_need.length) !== this.hash_need) {
            nonce++;
            hash = this.hashBlock(prevBlockHash, currentBlockData, nonce);
            // sleep by microsec / cpu tick
        }
        return nonce;
    }

    addToPendingTransactions(transaction) {
        this.pendingTransactions.push(transaction);
    }

    validAddress(addr) {
        return ((addr.length == this.generateNewWallet().public_key.length) == true && (addr.match("^[a-zA-Z0-9]*$")) != null);
    }

    createNewTransaction(hash, amount, sender, recipient, signature, initiated){
        let transaction = new Transaction({
            id: hash,
            amount: amount,
            sender: sender, 
            recipient: recipient,
            timestamp: initiated,
            signature: signature,
        }, false);

        return transaction;
    }

    clearPendingTransactions() {
        this.pendingTransactions = [];
    }

    isValidChain(chain)
    {
        let validChain = true;
        for (var i = 1; i < chain.length; i++) {
            let curBlock = chain[i];
            let prevBlock = chain[i - 1];
            let hash = this.hashBlock(curBlock.prevBlockHash, {transactions: curBlock.transactions, index: curBlock.id}, curBlock.nonce);

            if (curBlock.prevBlockHash != prevBlock.hash 
                || hash.substring(0, this.hash_need.length) !== this.hash_need) {
                validChain = false;
            }
        }
        let genesis = chain[0]; // not sure if thats really usefull
        if (genesis.nonce != 0 || genesis.hash !== '0' || genesis.prevBlockHash !== '0'
            || genesis.transactions.length > 0) {
            validChain = false;
        }

        var EC = require('elliptic').ec;
        var ec = new EC('secp256k1');
        for (var block of chain) {
            for (var transaction of block.transactions)
            {
                let key = ec.keyFromPublic(transaction.sender, "hex");
                let signature = Utils.convertHexStringToNumArray(transaction.signature);
                
                let t = {
                    amount: transaction.amount,
                    recipient: transaction.recipient,
                    sender: transaction.sender,
                    initiated: transaction.timestamp
                }
                
                let txHash = sha256(JSON.stringify(t));
                if (!key.verify(txHash, signature)) {
                    return false;
                }
            }
        }
        return validChain;
    }

    getAddressData(address) {
        let results = {received: [], sent: [], balance: 0.00};

        for (var block of this.chain) {
            for (var transaction of block.transactions)
            {
                if (transaction.sender === address) { results.sent.push(transaction); results.balance -= transaction.amount; }
                if (transaction.recipient === address) { results.recipient.push(transaction); results.balance += transaction.amount; }
            }
        }
        if (address === "00")  { // base address
            results.balance = this.miningReward;
        }
        return results;
    }
};
