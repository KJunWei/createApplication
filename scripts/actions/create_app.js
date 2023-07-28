const algosdk = require("algosdk");
const fs = require("fs");
const path = require("path");
const {
  optIntoAsset,
  getMethodByName,
  makeATCCall,
  getAlgodClient,
} = require("../helpers/algorand");
require("dotenv").config();

const algodClient = getAlgodClient();

(async () => {
  const creator = algosdk.mnemonicToSecretKey(process.env.CREATOR_MNEMONIC);

  // get application
  const appID = Number(process.env.APP_ID);
  console.log(algosdk.getApplicationAddress(appID));
  console.log("App ID is: ", appID);

  const suggestedParams = await algodClient.getTransactionParams().do();

  const commonParams = {
    appID,
    sender: creator.addr,
    suggestedParams,
    signer: algosdk.makeBasicAccountTransactionSigner(creator),
  };

  const getBasicProgramBytes = async (relativeFilePath) => {
    // Read file for Teal code
    const filePath = path.join(__dirname, relativeFilePath);
    const data = fs.readFileSync(filePath);

    // use algod to compile the program
    const compiledProgram = await algodClient.compile(data).do();
    return new Uint8Array(Buffer.from(compiledProgram.result, "base64"));
  };

  // programs
  const approvalProgram = await getBasicProgramBytes(
    "../../artifacts/approval.teal"
  );
  const clearProgram = await getBasicProgramBytes("../../artifacts/clear.teal");

  const boxKey = new Uint8Array(Buffer.from('accounts'))
  // create NFT
  const txn1 = [
    {
      method: getMethodByName("create_application"),
      methodArgs: [
        1, // global_num_uints
        1, // global_num_byte_slices
        1, // local_num_uints
        1, // local_num_byte_slices
        approvalProgram, // approval_program
        clearProgram, // clear_state_program
        1, // extra_program_pages
      ],
      appAccounts: [creator.addr], // accounts
      appForeignAssets: [], // assets
      appForeignApps: [1022], // applications
      boxes: [ // to edit the box within the smart contract
        {
          appIndex: 0,
          name: boxKey
        }
      ],
      ...commonParams,
    },
  ];

  // fetch the return value from the app call txn
  const txnOutputs = await makeATCCall(txn1);
  const app_id = Number(txnOutputs.methodResults[0].returnValue);
  console.log(`App ${app_id} created by contract`);

})();
