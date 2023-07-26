require("dotenv").config();
const algosdk = require("algosdk");
const algotxn = require("./helpers/algorand");

(async () => {
  const creator = algosdk.mnemonicToSecretKey(process.env.CREATOR_MNEMONIC);

  // deploy app
  const { confirmation } = await algotxn.deployDemoApp(creator);
  const appId = confirmation["application-index"];
  console.log(`Deployed App ID is ${appId}. Save this app ID in the env file.`);

  // fund contract
  const appAddress = algosdk.getApplicationAddress(appId);
  await algotxn.fundAccount(creator, appAddress, 5e6);

})();
