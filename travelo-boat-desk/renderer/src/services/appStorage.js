export const appStorage = {
  async load() {
    if (window?.api?.getAppStatus) {
      return window.api.getAppStatus();
    }

    return {
      isPaired: localStorage.getItem("isPaired") === "true",
      authToken: localStorage.getItem("authToken"),
    };
  },

  async setPaired(isPaired) {
    if (window?.api?.setPaired) return window.api.setPaired(isPaired);
    localStorage.setItem("isPaired", String(isPaired));
  },

  async setAuthToken(token) {
    if (window?.api?.setAuthToken) return window.api.setAuthToken(token);
    if (token) localStorage.setItem("authToken", token);
    else localStorage.removeItem("authToken");
  },
};
