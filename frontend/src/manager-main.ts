import { createApp } from "vue";
import Toast, { POSITION, type PluginOptions } from "vue-toastification";
import Root from "./Root.vue";
import router from "./router";
import { pinia } from "./stores";
import "vue-toastification/dist/index.css";
import "./style.css";

const toastOptions: PluginOptions = {
  position: POSITION.TOP_RIGHT,
  timeout: 2800,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  hideProgressBar: false,
  maxToasts: 4,
  newestOnTop: true,
  showCloseButtonOnHover: true,
  closeButton: "button",
};

const app = createApp(Root);
app.use(pinia);
app.use(router);
app.use(Toast, toastOptions);
app.mount("#app");
