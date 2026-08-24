import { createApp } from "vue";
import MemoryApp from "./memory/MemoryApp.vue";
import "@fontsource-variable/noto-serif-sc/wght.css";
import "./memory/memory.css";

document.documentElement.lang = "zh-CN";
document.title = "拾光 · B站收藏时光机";

createApp(MemoryApp).mount("#app");
