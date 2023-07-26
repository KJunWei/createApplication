const algosdk = require("algosdk");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const algodClient = new algosdk.Algodv2(
  process.env.ALGOD_TOKEN,
  process.env.ALGOD_SERVER,
  process.env.ALGOD_PORT
);

const getAlgodClient = () => {
  return algodClient;
};

const submitToNetwork = async (signedTxns) => {
  // send txn
  const response = await algodClient.sendRawTransaction(signedTxns).do();

  // Wait for transaction to be confirmed
  const confirmation = await algosdk.waitForConfirmation(
    algodClient,
    response.txId,
    4
  );

  return {
    response,
    confirmation,
  };
};

const getBasicProgramBytes = async (relativeFilePath) => {
  // Read file for Teal code
  const filePath = path.join(__dirname, relativeFilePath);
  const data = fs.readFileSync(filePath);

  // use algod to compile the program
  const compiledProgram = await algodClient.compile(data).do();
  return new Uint8Array(Buffer.from(compiledProgram.result, "base64"));
};


const deployDemoApp = async (fromAccount) => {
  const suggestedParams = await algodClient.getTransactionParams().do();

  // programs
  const approvalProgram = await getBasicProgramBytes(
    "../../artifacts/approval.teal"
  );
  const clearProgram = await getBasicProgramBytes("../../artifacts/clear.teal");

  // global / local states
  const numGlobalInts = 1;
  const numGlobalByteSlices = 1;
  const numLocalInts = 1;
  const numLocalByteSlices = 1;

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    from: fromAccount.addr,
    suggestedParams,
    approvalProgram,
    clearProgram,
    numGlobalInts,
    numGlobalByteSlices,
    numLocalInts,
    numLocalByteSlices,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const fundAccount = async (fromAccount, to, amount) => {
  let suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: fromAccount.addr,
    to,
    amount,
    suggestedParams,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const callApp = async (fromAccount, appIndex, appArgs, accounts) => {
  // get suggested params
  const suggestedParams = await algodClient.getTransactionParams().do();

  // call the created application
  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    from: fromAccount.addr,
    suggestedParams,
    appIndex,
    appArgs,
    accounts,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const optIntoApp = async (fromAccount, appIndex) => {
  const acc = await algodClient.accountInformation(fromAccount.addr).do();
  const localStates = acc["apps-local-state"];

  const appLocalState = localStates.find((ls) => {
    return ls.id === appIndex;
  });

  // account has already opted into app
  if (appLocalState !== undefined) return;

  // get suggested params
  const suggestedParams = await algodClient.getTransactionParams().do();

  // call the created application
  const txn = algosdk.makeApplicationOptInTxnFromObject({
    from: fromAccount.addr,
    suggestedParams,
    appIndex,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const optIntoAsset = async (fromAccount, assetId) => {
  // get suggested params
  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: fromAccount.addr,
    to: fromAccount.addr,
    assetIndex: assetId,
    amount: 0,
    suggestedParams,
  });

  const signedTxn = txn.signTxn(fromAccount.sk);
  return await submitToNetwork(signedTxn);
};

const getMethodByName = (methodName) => {
  // Read in the local contract.json file
  const source = path.join(__dirname, "../../artifacts/contract.json");
  const buff = fs.readFileSync(source);

  // Parse the json file into an object, pass it to create an ABIContract object
  const contract = new algosdk.ABIContract(JSON.parse(buff.toString()));

  const method = contract.methods.find((mt) => mt.name === methodName);

  if (method === undefined) throw Error("Method undefined: " + method);

  return method;
};

const makeATCCall = async (txns) => {
  // create atomic transaction composer
  const atc = new algosdk.AtomicTransactionComposer();

  // add calls to atc
  txns.forEach((txn) => {
    if (txn.method !== undefined) {
      atc.addMethodCall(txn);
    } else {
      atc.addTransaction(txn);
    }
  });

  // execute
  const result = await atc.execute(algodClient, 10);
  for (const idx in result.methodResults) {
    console.log(result.methodResults[idx]);
  }

  return result;
};

module.exports = {
  deployDemoApp,
  fundAccount,
  callApp,
  optIntoApp,
  optIntoAsset,
  submitToNetwork,
  getMethodByName,
  makeATCCall,
  getAlgodClient,
};
