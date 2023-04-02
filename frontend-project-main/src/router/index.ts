import { createRouter, createWebHistory } from "vue-router";

const routerHistory = createWebHistory();

const router = createRouter({
  history: routerHistory,
  routes: [
    {
      path: "/pdf-viewer",
      name: "pdf-viewer",
      component: () => import("@/views/PDFViewer/pdf-viewer.vue"),
    },
  ],
});

export default router;
