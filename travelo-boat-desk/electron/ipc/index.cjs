const { registerAppIpc } = require("./app.cjs");

function registerIpcHandlers() {
  registerAppIpc();
}

module.exports = { registerIpcHandlers };