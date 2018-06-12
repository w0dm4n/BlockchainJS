const rp = require("request-promise");

var EC = require('elliptic').ec;
var ec = new EC('secp256k1');

let pub = "04c92b79fef5883a11e16bd2ce3f6626832031decb8fb85193c11947af32dac2974e8ef77b266900bfb6904251cb9f06fe27da473232ef972a3ed0ad80bac27d79";
let priv = "7911f87905f2165c75b02077caaf7f59e99a0ff14a05b8ee3e401fa6eb6b7373";

let node = "http://localhost:3002";

let amount = process.argv[2];
let recipient = process.argv[3];

let transaction = {
    amount: amount,
    recipient: recipient,
    sender: pub
}

let key = ec.keyFromPrivate(priv);
transaction.signature = key.sign(Buffer.from(JSON.stringify(transaction))).toDER();

rp({
    method: "POST",
    uri: `${node}/transaction/broadcast`,
    body: transaction,
    json: true,
    timeout: 1500
}).then((answer) => {console.log(answer);}).catch(() => {});


console.log(transaction, `sent to node ${node}`);