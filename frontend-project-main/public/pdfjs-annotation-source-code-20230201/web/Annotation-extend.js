// 功能：点击批注后跳转到批注所在页面，要用该函数替换原本 annotation.js中的同名函数
function selectAnnotation(node) {
	event.stopPropagation();
	var node_id = node.parentNode.getAttribute('id');
	var id_split = node_id.split('-');
	// console.log('id列表', id_split);
	var page_number = id_split[1];
	PDFViewerApplication.page = parseInt(page_number);
	//不透明度闪烁
	setTimeout(() => {
		shiningAnnotation(id_split);
	}, 1000);
}

//使批注闪烁
function shiningAnnotation(id_split) {
	var anno_id = id_split[3];
	var page_number=id_split[1];

	var fabricObj = getFabricObj(page_number);
	// console.log('fabricObj', fabricObj);

	var fabric_canvas = fabricObj.page_canvas.fabric_canvas;
	var anno_objects = fabric_canvas.getObjects();
	anno_objects.forEach(anno_item => {
		if (anno_item.id == anno_id) {
			var old_opacity = anno_item.opacity;
			var max_opacity = 1;
			var min_opacity = 0.1;

			//不透明度闪烁
			setTimeout(() => {
				anno_item.set('opacity', min_opacity);
				fabric_canvas.requestRenderAll();
			}, 300);

			setTimeout(() => {
				anno_item.set('opacity', max_opacity);
				fabric_canvas.requestRenderAll();
			}, 600);

			setTimeout(() => {
				anno_item.set('opacity', min_opacity);
				fabric_canvas.requestRenderAll();
			}, 900);

			setTimeout(() => {
				anno_item.set('opacity', max_opacity);
				fabric_canvas.requestRenderAll();
			}, 1200);

			setTimeout(() => {
				anno_item.set('opacity', min_opacity);
				fabric_canvas.requestRenderAll();
			}, 1500);

			setTimeout(() => {
				anno_item.set('opacity', max_opacity);
				fabric_canvas.requestRenderAll();
			}, 1800);

			setTimeout(() => {
				anno_item.set('opacity', old_opacity);
				fabric_canvas.requestRenderAll();
			}, 2100);
		}
	});
}


//先跳转页码，然后一秒之后高亮
function highLightTargetCor(page_number,highlight_coor){
	PDFViewerApplication.page=page_number;
	setTimeout(()=>{
		addAnnotationToFabric(highlight_coor, []);
	},1000);
}

//保留pdf渲染页面的手势缩放，要用该函数替换原本 annotation.js中的同名函数
function forceZoomIn() {
	var DEFAULT_SCALE_DELTA = 1.1;
	var MAX_SCALE = 2.4;
	let newScale = window.PDFViewerApplication.pdfViewer.currentScale;
	newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
	newScale = Math.ceil(newScale * 10) / 10;
	newScale = Math.min(MAX_SCALE, newScale);
	window.PDFViewerApplication.pdfViewer.currentScaleValue = newScale;
	//draw annotation 绘制批注
	drawAllPageAnnotations();
}