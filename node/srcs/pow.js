
const sha256 = require("sha256");

function hashBlock(prevBlockHash, currentBlockData, nonce) {
    let rawData = prevBlockHash + nonce.toString() + currentBlockData;
    let blockHash = sha256(rawData);

    return blockHash;
}

function proofOfWork(prevBlockHash, currentBlockData, hash_need)
{
    let nonce = 0;
    let hash = hashBlock(prevBlockHash, currentBlockData, nonce);

    while (hash.substring(0, hash_need.length) !== hash_need) {
        nonce++;
        hash = hashBlock(prevBlockHash, currentBlockData, nonce);
    }
    return nonce;
}

console.log(proofOfWork(process.argv[2], process.argv[3], process.argv[4]));