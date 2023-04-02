<script setup lang="ts">
import {onMounted, ref} from "vue";
import type {Property} from '@/views/PDFViewer/models/Property'
import type {Group} from "@/views/PDFViewer/models/Group";
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import Dropdown from 'primevue/dropdown';
import Divider from 'primevue/divider';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Checkbox from 'primevue/checkbox';
import SpeedDial from 'primevue/speeddial';
import Editor from 'primevue/editor';
import InputNumber from 'primevue/inputnumber';

let viewer = ref();
let fileName = ref<string>('');
let iframeHeight = `${window.innerHeight-60}px`;
let groups = ref<Group[]>([{
  groupName: 'tenantData',
  properties: [{
    id: "uuid3",
    pageNumber: 1,
    name: 'Tenant Name',
    comment: '',
    content: 'Global Financial & Insurance Services Inc, a Texas corporation',
    rects: {
      pageNumber: 1,
      boundingRect: {
        x1:203.49,
        y1:440.36600000000004,
        x2:334.985,
        y2:461.41600000000005,
        width:595.0,
        height:842.0
      }
    },
    isConfirmed: false,
    isImage: false
  }]
}]);

let openDialog = ref<boolean>(false);
let openTextDialog = ref<boolean>(false);
let openImageDialog = ref<boolean>(false);

// pdf selections
let pdfs = ref<any[]>([
  {name: 'example_new.pdf', status: "active"},
  {name: 'Searchable-2711 LBJ_Global Financial_02.01.21.pdf', status: "disable"}
]);
let selected = ref();
let property: Property;
let propertyName = ref<string>('');
let groupName = ref<string>('');
let image = ref();
let manualText = ref<string>('');
let manualPageNo = ref<number>(0);

// region pdf-js highlight event listener
window.addEventListener('message', (e) => {
  if (e.data?.source == 'pdfjs-highlight') {
    property = {
      pageNumber: e.data.content.page_number,
      comment: e.data.content.comment,
      content: e.data.content.all_str,
      rects: e.data.content.rects,
      isImage: false
    } as Property;

    openDialog.value = true;
  }
});
// endregion

const jumpPage = (pageNumber: number) => {
  viewer.value.contentWindow.PDFViewerApplication.page = parseInt(pageNumber.toString());
}

const onDropdownChange = (event: any) => {
  fileName.value = event.value.name;

  firstHighlight();
}

onMounted(() => {
  localStorage.clear();
})

// region Manual Highlight
const manualHighlight = () => {
  let group = groups.value.find(x => x.groupName == groupName.value);
  property.name = propertyName.value;

  if (group) {
    // page has other annotation
    group.properties.push(property)
  } else {
    // create new group
    let pageGroup = {
      groupName: groupName.value,
      properties: []
    } as Group

    pageGroup.properties.push(property);
    groups.value.push(pageGroup)
  }

  // accordionOpenIndex.value = annotation.pageNumber - 1;
  openDialog.value = false;
  propertyName.value = '';
}
const manualHighlightText = () => {
  let group = groups.value.find(x => x.groupName == groupName.value);

  property = {
    id: "",
    pageNumber: manualPageNo.value,
    comment: '',
    content: manualText.value,
    rects: {},
    name: propertyName.value,
    isConfirmed: false,
    isImage: false
  } as Property;

  if (group) {
    // page has other annotation
    group.properties.push(property)
  } else {
    // create new group
    let pageGroup = {
      groupName: groupName.value,
      properties: []
    } as Group

    pageGroup.properties.push(property);
    groups.value.push(pageGroup)
  }

  // accordionOpenIndex.value = annotation.pageNumber - 1;
  openTextDialog.value = false;
  propertyName.value = '';
  manualText.value = '';
  groupName.value = '';
  manualPageNo.value = 0;
}
const manualHighlightImage = () => {
  let group = groups.value.find(x => x.groupName == groupName.value);

  property = {
    id: "",
    pageNumber: manualPageNo.value,
    comment: '',
    content: image.value,
    rects: {},
    name: propertyName.value,
    isConfirmed: false,
    isImage: true
  } as Property;

  if (group) {
    // page has other annotation
    group.properties.push(property)
  } else {
    // create new group
    let pageGroup = {
      groupName: groupName.value,
      properties: []
    } as Group

    pageGroup.properties.push(property);
    groups.value.push(pageGroup)
  }

  // accordionOpenIndex.value = annotation.pageNumber - 1;
  openImageDialog.value = false;
  propertyName.value = '';
  groupName.value = '';
  manualPageNo.value = 0;
}
// endregion

// region SpeedDial
let speedDialItems = [
  {
    label: 'Add text',
    icon: 'pi pi-pencil',
    command: () => {
      openTextDialog.value = true;
    }
  },
  {
    label: 'Add picture',
    icon: 'pi pi-image',
    command: () => {
      openImageDialog.value = true;
    }
  },
]
// endregion

// region textract

const input_coor = {
  "Page": 1,
  "Id": "f9667be9-9148-4a71-9508-a36d27fcc907",
  "Text": "LEASE AGREEMENT",
  "Geometry": {
    "BoundingBox": {
      "Width": 0.16777185,
      "Height": 0.011277317,
      "Left": 0.39917845,
      "Top": 0.12617083
    },
    "Polygon": [{
      "X": 0.39919543,
      "Y": 0.12617083
    },
      {
        "X": 0.5669503,
        "Y": 0.12628508
      },
      {
        "X": 0.5669337,
        "Y": 0.13744815
      },
      {
        "X": 0.39917845,
        "Y": 0.13733386
      }
    ]
  },
}

const firstHighlight = () => {
  var BoundingBox = input_coor['Geometry']['BoundingBox'];
  var new_all_rect = [BoundingBox['Left'], BoundingBox['Top'], BoundingBox['Width'], BoundingBox['Height']];


  var poly = input_coor['Geometry']['Polygon'];
  var new_rects = [];

  var new_left = poly[0]['X'];
  var new_top = poly[0]['Y'];
  var new_width = poly[2]['X'] - new_left;
  var new_height = poly[2]['Y'] - new_top;
  new_rects.push([new_left, new_top, new_width, new_height]);

  var new_id=new Date().getTime()+'_'+input_coor['Id'];
  var highlight_coor = {
    "id": new_id,
    "page_number": input_coor['Page'],
    "member_id": "user_1",
    "save_scale_x": "1.00000000",
    "save_scale_y": "1.00000000",
    "comment": "add comment",
    "type": "highlight",
    "true_size": [100, 100],
    "all_rect": new_all_rect,
    "all_str": input_coor['Text'],
    "rects": new_rects,
  };

  //pdf_container
  setTimeout(() => {
    document.getElementById("pdf_container").contentWindow.highLightTargetCor(input_coor['Page'],highlight_coor);
  }, 5000);

}

// endregion
</script>

<template>
  <Splitter :height="iframeHeight">
    <SplitterPanel :size="20">
      <div class="flex flex-col content-between justify-between h-[920px]">
        <section v-if="groups.length > 0">
          <div v-for="group in groups">
            <Divider>
              <div class="inline-flex">
                <b>{{ group.groupName }}</b>
              </div>
            </Divider>
            <div class="flex flex-col">
              <div v-for="annotation in group.properties" class="flex justify-between items-center px-8 mb-2" @click="jumpPage(annotation.pageNumber)">
                <div v-if="!annotation.isImage" class="flex flex-column items-center gap-2">
                  <label for="username">{{ annotation.name }}</label>
                  <InputText id="username" v-model="annotation.content" aria-describedby="username-help"/>
                </div>
                <div v-else class="flex flex-column items-center gap-2">
                  <label for="username">{{ annotation.name }}</label>
                  <div v-html="annotation.content"></div>
                </div>
                <Checkbox class="ml-[50px]" v-model="annotation.isConfirmed" :binary="true"/>
              </div>
            </div>
          </div>
        </section>
        <div class="flex align-items-end justify-content-center">
          <SpeedDial style="position: relative"
                     :model="speedDialItems"
                     direction="up"
                     :transitionDelay="80"
                     showIcon="pi pi-bars"
                     hideIcon="pi pi-times"
                     buttonClass="p-button-outlined"
                     :tooltipOptions="{ position: 'left' }"/>
        </div>
      </div>
    </SplitterPanel>
    <SplitterPanel :size="80">
      <div>
        <Dropdown v-model="selected" :options="pdfs" optionLabel="name" @change="onDropdownChange($event)"
                  class="w-[300px] mb-4" placeholder="Please Select">
          <template #value="slotProps">
            <div v-if="slotProps.value" class="flex align-items-center">
              <div>{{ slotProps.value.name }}</div>
            </div>
            <span v-else>
            {{ slotProps.placeholder }}
            </span>
          </template>
          <template #option="slotProps">
            <div class="flex align-items-center">
              <div
                  :class="[{'text-primary-100': slotProps.option.status === 'active', 'text-secondary-100': slotProps.option.status === 'disable'}]">
                {{ slotProps.option.name }}
              </div>
            </div>
          </template>
        </Dropdown>
      </div>
      <iframe ref='viewer' name="pdf_container" :height="iframeHeight"
              id="pdf_container" :src="'pdfjs-annotation-source-code-20230201/web/viewer.html?file='+fileName"
              width="100%"></iframe>
    </SplitterPanel>
  </Splitter>

  <Dialog v-model:visible="openDialog" modal="true" :style="{width: '20vw'}">
    <template #header>
      <h3>Add text</h3>
    </template>
    <div class="field h-[3.5vw] flex items-center">
      <label for="categoryName" class="mr-4">CategoryName</label>
      <InputText id="categoryName" type="text" v-model="groupName" class="h-[35px]"/>
    </div>
    <div class="field h-[3.5vw] flex items-center">
      <label for="annotationName" class="mr-4">PropertyName</label>
      <InputText id="annotationName" type="text" v-model="propertyName" class="h-[35px]"/>
    </div>
    <div class="flex justify-end">
      <Button label="ok" class="p-button-text" @click="manualHighlight"/>
    </div>
  </Dialog>

  <Dialog v-model:visible="openTextDialog" modal="true" :style="{width: '20vw'}">
    <template #header>
      <h3>Add text</h3>
    </template>
    <div class="field h-[3.5vw] flex items-center">
      <label for="categoryName" class="mr-4">CategoryName</label>
      <InputText id="categoryName" type="text" v-model="groupName" class="h-[35px]"/>
    </div>
    <div class="field h-[3.5vw] flex items-center">
      <label for="propertyName" class="mr-4">PropertyName</label>
      <InputText id="propertyName" type="text" v-model="propertyName" class="h-[35px]"/>
    </div>
    <div class="field h-[3.5vw] flex items-center">
      <label for="textName" class="mr-4">TextValue</label>
      <InputText id="textName" type="text" v-model="manualText" class="h-[35px]"/>
    </div>
    <div class="field h-[3.5vw] flex items-center">
      <label for="manualPageNo" class="mr-4">PageNo</label>
      <InputNumber id="manualPageNo" type="text" v-model="manualPageNo" class="h-[35px]"/>
    </div>
    <div class="flex justify-end">
      <Button label="ok" class="p-button-text" @click="manualHighlightText"/>
    </div>
  </Dialog>

  <Dialog v-model:visible="openImageDialog" maximizable  modal="true" :style="{width: '20vw'}">
    <template #header>
      <h3>Add Image</h3>
    </template>
    <div class="field h-[3.5vw] flex items-center">
      <label for="categoryName" class="mr-4">CategoryName</label>
      <InputText id="categoryName" type="text" v-model="groupName" class="h-[35px]"/>
    </div>
    <div class="field h-[3.5vw] flex items-center">
      <label for="propertyName" class="mr-4">PropertyName</label>
      <InputText id="propertyName" type="text" v-model="propertyName" class="h-[35px]"/>
    </div>
    <div class="field flex">
      <label for="image" class="mr-4">Image</label>
      <Editor v-model="image" editorStyle="height: 320px"/>
    </div>
    <div class="field h-[3.5vw] flex items-center">
      <label for="manualPageNo" class="mr-4">PageNo</label>
      <InputNumber id="manualPageNo" type="text" v-model="manualPageNo" class="h-[35px]"/>
    </div>
    <div class="flex justify-end">
      <Button label="ok" class="p-button-text" @click="manualHighlightImage"/>
    </div>
  </Dialog>
</template>


