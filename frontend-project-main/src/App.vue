<script setup lang="ts">
import TheDefaultLayout from '@/layouts/TheDefaultLayout.vue'

</script>

<template>
  <TheDefaultLayout></TheDefaultLayout>
</template>


<!--<script>-->
<!--import PDFJSViewer from './views/PDFJSViewer.vue'-->

<!--export default {-->
<!--  name: 'App',-->
<!--  components: {-->
<!--    PDFJSViewer-->
<!--  },-->
<!--  data () {-->
<!--    return {-->
<!--      name: 'lbj.pdf',-->
<!--      path: 'lib/web/viewer.html',-->
<!--      pdf_path: 'example_new.pdf',-->
<!--    }-->
<!--  },-->
<!--  mounted() {-->

<!--    window.addEventListener('message', (e) => {-->
<!--      if (e.data.source != 'pdfjs-highlight') {-->
<!--        return;-->
<!--      }-->
<!--      document.getElementById('current-highlight').innerText=JSON.stringify(e.data.content);-->
<!--      console.log('接收到高亮信息',e.data);-->
<!--    });-->
<!--    //屏幕变化时-->
<!--    window.onresize = () => {-->
<!--      return (() => {-->
<!--        vm.resizeWin();-->
<!--      })();-->
<!--    };-->
<!--    //测试知网翻译-->

<!--  },-->
<!--  methods(){-->
<!--    // this.$refs.pdfjs_viewer_1.contentWindow.addAnnotationToFabric();-->
<!--  }-->
<!--}-->
<!--</script>-->
