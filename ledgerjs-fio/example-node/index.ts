import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { Fio, HARDENED, GetPublicKeyRequest, SignTransactionRequest, Transaction } from "../src/fio";
const fetch = require('node-fetch')

const wait = () => {
  const inputReader = require('wait-console-input')
  inputReader.wait('');
}


async function example() {
  console.log("Running FIO examples");
  const transport = await TransportNodeHid.create(5000)
  const appFio = new Fio(transport);

  console.log("\n".repeat(3));
  console.log("Input: getVersion");
  wait()
  console.log("Response:");
  console.log(await appFio.getVersion());
  wait()
  console.log("\n".repeat(3));

  console.log("Input: getSerial");
  wait()
  console.log("Response:");
  console.log(await appFio.getSerial());
  wait()
  console.log("\n".repeat(3));

  const getPublicKeyRequest1: GetPublicKeyRequest = { path: [44 + HARDENED, 235 + HARDENED, 0 + HARDENED, 0, 0], show_or_not: false };
  console.log("Input: getPublicKey");
  console.log(getPublicKeyRequest1);
  wait()
  console.log("Response:");
  console.log(await appFio.getPublicKey(getPublicKeyRequest1));
  wait()
  console.log("\n".repeat(3));

  const getPublicKeyRequest2: GetPublicKeyRequest = { path: [44 + HARDENED, 235 + HARDENED, 0 + HARDENED, 0, 2000], show_or_not: false };
  console.log("Input: getPublicKey");
  console.log(getPublicKeyRequest2);
  wait()
  console.log("Response:");
  console.log(await appFio.getPublicKey(getPublicKeyRequest2));
  wait()
  console.log("\n".repeat(3));

  const basicTx: Transaction = {
    expiration: "2021-08-28T12:50:36.686",
    ref_block_num: 0x1122,
    ref_block_prefix: 0x33445566,
    context_free_actions: [],
    actions: [{
      account: "fio.token",
      name: "trnsfiopubky",
      authorization: [{
        actor: "aftyershcu22",
        permission: "active",
      }],
      data: {
        payee_public_key: "FIO8PRe4WRZJj5mkem6qVGKyvNFgPsNnjNN6kPhh6EaCpzCVin5Jj",
        amount: "2000",
        max_fee: 0x11223344,
        tpid: "rewards@wallet",
        actor: "aftyershcu22",
      },
    }],
    transaction_extensions: [],
  }
  const infoTestnet = await (await fetch('http://testnet.fioprotocol.io/v1/chain/get_info')).json()
  const signTransactionRequest: SignTransactionRequest = {
    path: [44 + HARDENED, 235 + HARDENED, 0 + HARDENED, 0, 0],
    chainId: infoTestnet.chain_id,
    tx: basicTx
  };
  console.log("Input: signTransaction");
  console.log(signTransactionRequest);
  console.log(signTransactionRequest.tx.actions);
  wait()
  console.log("Response:");
  console.log(await appFio.signTransaction(signTransactionRequest));
  wait()
  console.log("\n".repeat(3));
}

const experiment = async () => {
  const transport = await TransportNodeHid.create(5000)
  const appFio = new Fio(transport);
  const basicTx: Transaction = {
    expiration: "2021-08-28T12:50:36.686",
    ref_block_num: 0x1122,
    ref_block_prefix: 0x33445566,
    context_free_actions: [],
    actions: [{
      account: "fio.token",
      name: "trnsfiopubky",
      authorization: [{
        actor: "aftyershcu22",
        permission: "active",
      }],
      data: {
        payee_public_key: "FIO8PRe4WRZJj5mkem6qVGKyvNFgPsNnjNN6kPhh6EaCpzCVin5Jj",
        amount: "2000",
        max_fee: 0x11223344,
        tpid: "rewards@wallet",
        actor: "aftyershcu22",
      },
    }],
    transaction_extensions: [],
  };
  const infoTestnet = await (await fetch('http://testnet.fioprotocol.io/v1/chain/get_info')).json();
  const signTransactionRequest: SignTransactionRequest = {
    path: [44 + HARDENED, 235 + HARDENED, 0 + HARDENED, 0, 0],
    chainId: infoTestnet.chain_id,
    tx: basicTx
  };

  const result = await appFio.signTransaction(signTransactionRequest);
}

// example()
experiment();